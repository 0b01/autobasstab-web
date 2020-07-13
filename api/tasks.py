from datetime import timedelta
import os
import os.path
import pathlib

from django.core.files import File
from django.core.files.base import ContentFile
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

from huey import crontab
from huey.contrib.djhuey import task, periodic_task

from .models import ProcessedTrack, YTAudioDownloadTask
from .separate import SpleeterSeparator
from .youtubedl import *

@periodic_task(crontab(minute='*/30'))
def check_in_progress_tasks():
    """Periodic task that checks for stale separation tasks and marks them as erroneous."""
    time_threshold = timezone.now() - timedelta(minutes=settings.STALE_TASK_MIN_THRESHOLD)
    in_progress_tracks = ProcessedTrack.objects.filter(status=ProcessedTrack.Status.IN_PROGRESS, date_created__lte=time_threshold)
    in_progress_tracks.update(status=ProcessedTrack.Status.ERROR, error='Operation timed out')

@task()
def separate_task(processing_track):
    """
    Task that uses Spleeter API to separate/isolate the requested parts of a track.

    :param processing_track: The audio track model (ProcessedTrack) to be processed
    """
    # Mark as in progress
    processing_track.status = ProcessedTrack.Status.IN_PROGRESS
    processing_track.save()
    try:
        # Get paths
        directory = os.path.join(settings.MEDIA_ROOT, settings.SEPARATE_DIR, str(processing_track.id))
        filename = slugify(processing_track.formatted_name()) + '.mp3'
        rel_dir_name = os.path.join(settings.SEPARATE_DIR, str(processing_track.id))
        pathlib.Path(directory).mkdir(parents=True, exist_ok=True)
        separator = SpleeterSeparator()

        parts = {
            'vocals': processing_track.vocals,
            'drums': processing_track.drums,
            'bass': processing_track.bass,
            'other': processing_track.other
        }

        # Non-local filesystems like S3/Azure Blob do not support source_path()
        is_local = settings.DEFAULT_FILE_STORAGE == 'django.core.files.storage.FileSystemStorage'
        inpath = processing_track.source_path() if is_local else processing_track.source_url()
        already_separated = ProcessedTrack.objects.filter(source_track=processing_track.source_track, bass=True, drums=False,vocals=False,other=False,status=ProcessedTrack.Status.DONE).exists()
        print(already_separated)
        if already_separated:
            print("already exists")
            paths = separator.cached(parts, processing_track.source_track, rel_dir_name, filename)
        else:
            paths = separator.separate(parts, inpath, rel_dir_name, filename)

        for key, rel_path in paths.items():
            instance = ''
            if key != "req":
                instance, created = ProcessedTrack.objects.get_or_create(
                    source_track=processing_track.source_track,
                    vocals= key == "vocals",
                    drums= key == "drums",
                    bass= key == "bass",
                    other= key == "other")
                print(instance, created)
            else:
                instance = processing_track

            root_path = os.path.join(settings.MEDIA_ROOT, rel_path)
            # Check file exists
            if os.path.exists(root_path):
                instance.status = ProcessedTrack.Status.DONE
                if is_local:
                    print(rel_path)
                    # File is already on local filesystem
                    instance.file.name = rel_path
                else:
                    # Need to copy local file to S3/Azure Blob/etc.
                    if key == "req" or not already_separated:
                        raw_file = open(root_path, 'rb')
                        content_file = ContentFile(raw_file.read())
                        content_file.name = filename
                        instance.file = content_file
                        rel_dir_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                        # Remove local file
                        os.remove(root_path)
                        # Remove empty directory
                        os.rmdir(rel_dir_path)
                instance.save()
            else:
                raise Exception('Error writing to file')
    except FileNotFoundError as error:
        print(error)
        print('Please make sure you have FFmpeg and FFprobe installed.')
        processing_track.status = ProcessedTrack.Status.ERROR
        processing_track.error = str(error)
        processing_track.save()
    except Exception as error:
        print(error)
        processing_track.status = ProcessedTrack.Status.ERROR
        processing_track.error = str(error)
        processing_track.save()

@task(retries=settings.YOUTUBE_MAX_RETRIES)
def fetch_youtube_audio(source_file, artist, title, link):
    """
    Task that uses youtubedl to extract the audio from a YouTube link.

    :param source_file: SourceFile model
    :param artist: Track artist
    :param title: Track title
    :param link: YouTube link
    """
    fetch_task = source_file.youtube_fetch_task
    # Mark as in progress
    fetch_task.status = YTAudioDownloadTask.Status.IN_PROGRESS
    fetch_task.save()

    try:
        # Get paths
        directory = os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, str(source_file.id))
        filename = slugify(artist + ' - ' + title) + get_file_ext(link)
        rel_media_path = os.path.join(settings.UPLOAD_DIR, str(fetch_task.id), filename)
        rel_path = os.path.join(settings.MEDIA_ROOT, rel_media_path)
        pathlib.Path(directory).mkdir(parents=True, exist_ok=True)

        # Start download
        download_audio(link, rel_path)

        is_local = settings.DEFAULT_FILE_STORAGE == 'django.core.files.storage.FileSystemStorage'

        # Check file exists
        if os.path.exists(rel_path):
            fetch_task.status = YTAudioDownloadTask.Status.DONE
            if is_local:
                # File is already on local filesystem
                source_file.file.name = rel_media_path
            else:
                # Need to copy local file to S3/Azure Blob/etc.
                raw_file = open(rel_path, 'rb')
                content_file = ContentFile(raw_file.read())
                content_file.name = filename
                source_file.file = content_file
                rel_dir_path = os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, str(source_file.id))
                # Remove local file
                os.remove(rel_path)
                # Remove empty directory
                os.rmdir(rel_dir_path)
            fetch_task.save()
            source_file.save()
        else:
            raise Exception('Error writing to file')
    except Exception as error:
        print(error)
        fetch_task.status = YTAudioDownloadTask.Status.ERROR
        fetch_task.error = str(error)
        fetch_task.save()
        raise error
