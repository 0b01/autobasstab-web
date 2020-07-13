import os
import ffmpeg
import numpy as np
from spleeter import *
from spleeter.audio.adapter import get_default_audio_adapter
from spleeter.separator import Separator
from spleeter.utils import *
from django.conf import settings
from .models import ProcessedTrack

class SpleeterSeparator:
    """Performs source separation using Spleeter API."""
    def __init__(self, config=None):
        """Default constructor.

        :param config: Separator config, defaults to None
        """
        if config is None:
            self.audio_bitrate = '256k'
            self.audio_format = 'wav'
            self.sample_rate = 44100
            self.spleeter_stem = 'config/4stems-16kHz.json'
        else:
            self.audio_bitrate = config['audio_bitrate']
            self.audio_format = config['audio_format']
            self.sample_rate = config['sample_rate']
            self.spleeter_stem = config['spleeter_stem']
        # Use librosa backend as it is less memory intensive
        self.separator = Separator(self.spleeter_stem, stft_backend='librosa', multiprocess=False)
        self.audio_adapter = get_default_audio_adapter()

    def separate(self, parts, input_path, dir_name, file_name):
        """Performs source separation by adding together the parts to be kept.

        :param parts: List of parts to keep ('vocals', 'drums', 'bass', 'other')
        :param input_path: Path to source file
        :param output_path: Path to output file
        :raises e: FFMPEG error
        """
        waveform, _ = self.audio_adapter.load(input_path, sample_rate=self.sample_rate)
        prediction = self.separator.separate(waveform)
        out = np.zeros_like(prediction['vocals'])
        part_count = 0

        ret = {}

        # Add up parts that were requested
        for key in prediction:
            dir = os.path.join(dir_name, key+".mp3")
            self.audio_adapter.save(os.path.join(settings.MEDIA_ROOT, dir), prediction[key], self.separator._sample_rate, self.audio_format, self.audio_bitrate)
            ret[key] = dir
            if parts[key]:
                out += prediction[key]
                part_count += 1
        out /= part_count
        req_path = os.path.join(dir_name, file_name)
        self.audio_adapter.save(os.path.join(settings.MEDIA_ROOT, req_path), out, self.separator._sample_rate, self.audio_format, self.audio_bitrate)
        ret["req"] = req_path
        return ret

    def cached(self, parts, source_track, dir_name, file_name):
        bass_path = ProcessedTrack.objects.filter(source_track=source_track,    bass=True,  vocals=False, other=False, drums=False).first().file.name
        vocals_path = ProcessedTrack.objects.filter(source_track=source_track,  bass=False, vocals=True,  other=False, drums=False).first().file.name
        other_path = ProcessedTrack.objects.filter(source_track=source_track,   bass=False, vocals=False, other=True,  drums=False).first().file.name
        drums_path = ProcessedTrack.objects.filter(source_track=source_track,    bass=False, vocals=False, other=False, drums=True).first().file.name

        ret = {
            "bass": bass_path,
            "vocals": vocals_path,
            "other": other_path,
            "drums": drums_path,
        }
        load_paths = {k:ret[k] for k in parts if parts[k]}
        arrs = [self.audio_adapter.load(os.path.join(settings.MEDIA_ROOT, p))[0] \
            for p in load_paths.values()]
        out = sum(arrs) / len(arrs)
        req_path = os.path.join(dir_name, file_name)
        self.audio_adapter.save(os.path.join(settings.MEDIA_ROOT, req_path), out, self.separator._sample_rate, self.audio_format, self.audio_bitrate)
        ret["req"] = req_path
        return ret