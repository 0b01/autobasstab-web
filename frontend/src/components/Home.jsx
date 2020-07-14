import React, { Component } from 'react'
import axios from 'axios'
import { Alert, ProgressBar } from 'react-bootstrap'
import MusicPlayer from './MusicPlayer'
import MyNavBar from './MyNavBar'
import SongTable from './SongTable/SongTable'
import DeleteModal from './SongTable/DeleteModal'
import SpleetModal from './SongTable/SpleetModal'
import UploadModal from './Upload/UploadModal'
import * as tf from '@tensorflow/tfjs';
import { buffer } from '@tensorflow/tfjs'
import worker_script from "./worker.js";

/**
 * Home component where main functionality happens, consisting of the main nav bar
 * and the song table.
 */
class Home extends Component {
  constructor(props) {
    super(props)
    this.state = {
      crepe_total: 0,
      crepe_progress: 0,
      showDeleteModal: false, // Whether to show delete track modal
      showSpleetModal: false, // Whether to show source separation modal
      showUploadModal: false, // Whether to show upload modal
      songList: [],           // List of songs seen in the song table
      audioInstance: null,    // Reference audio player instance
      currentSrcSong: null,   // Current song, if it is a source song
      currentSepSong: null,   // Current song, if it is a processed song
      currentModalSong: null, // Current song displayed in the separation modal
      isPlaying: false,       // Whether audio is playing
      task: null,             // The separation task that was just submitted
      expandedIds: []         // List of IDs of expanded rows
    }


  }

  getAudioInstance = instance => {
    this.setState({
      audioInstance: instance
    })
  }

  onAudioPause = audioInfo => {
    this.setState({
      isPlaying: false
    })
  }

  onAudioPlay = audioInfo => {
    this.setState({
      isPlaying: true
    })
  }

  onSrcSongPauseClick = song => {
    this.setState({
      isPlaying: false
    })
    if (this.state.audioInstance) {
      this.state.audioInstance.pause()
    }
  }

  onSrcSongPlayClick = song => {
    if (
      this.state.currentSrcSong &&
      this.state.currentSrcSong.url === song.url
    ) {
      this.setState({
        isPlaying: true
      })
      if (this.state.audioInstance) {
        this.state.audioInstance.play()
      }
    } else {
      this.setState({
        currentSrcSong: song,
        currentSepSong: null,
        isPlaying: true
      })
    }
  }

  onSepSongPauseClick = song => {
    this.setState({
      isPlaying: false
    })
    if (this.state.audioInstance) {
      this.state.audioInstance.pause()
    }
  }

  onSepSongPlayClick = song => {
    if (this.state.currentSepSong && this.state.currentSepSong.url === song.url) {
      this.setState({
        isPlaying: true
      })
      if (this.state.audioInstance) {
        this.state.audioInstance.play()
      }
    } else {
      this.setState({
        currentSrcSong: null,
        currentSepSong: song,
        isPlaying: true
      })
    }
  }

  onSpleetTaskSubmit = (src_id, id, status) => {
    this.setState({
      task: {
        src_id: src_id,
        id: id,
        status: status
      },
      expandedIds: [...this.state.expandedIds, src_id]
    })
    this.loadData()
    // Set task state to null after 5 seconds
    setInterval(() => {
      this.setState({
        task: null
      })
    }, 5000)
  }

  /**
   * Called when single table row is expanded
   */
  onExpandRow = (row, isExpand) => {
    if (isExpand) {
      // Row is expanded, add the row ID to expanded row ID list
      this.setState({
        expandedIds: [...this.state.expandedIds, row.id]
      })
    } else {
      // Row is collapsed, remove current row ID from list
      this.setState({
        expandedIds: this.state.expandedIds.filter(s => s !== row.id)
      })
    }
  }

  /**
   * Called when the expand-all button is pressed
   */
  onExpandAll = (isExpandAll, results) => {
    if (isExpandAll) {
      // Update expanded row ID list to contain every row
      this.setState({
        expandedIds: results.map(i => i.id)
      })
    } else {
      // Clear expanded row ID list
      this.setState({
        expandedIds: []
      })
    }
  }

  onDeleteClick = song => {
    this.setState({ showDeleteModal: true, currentModalSong: song })
  }

  onSpleetClick = song => {
    this.setState({ showSpleetModal: true, currentModalSong: song })
  }

  onTabClick = song => {
    var context = new (window.AudioContext || window.webkitAudioContext)();
    var audioSrc = song.processed[0].url;

    var fetch = (url, resolve) => {
      var request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
      request.onload = function () { resolve(request) }
      request.send()
    }


    var onSuccess = (request) => {
      var audioData = request.response;
      context.decodeAudioData(audioData, onBuffer, onDecodeBufferError)
    }

    // perform resampling the audio to 16000 Hz, on which the model is trained.
    // setting a sample rate in AudioContext is not supported by most browsers at the moment.
    var resample = (audioBuffer, onComplete) => {
      const multiplier = audioBuffer.sampleRate / 16000;
      const original = audioBuffer.getChannelData(0);
      var ret = [];
      var i;
      for (i = 0; i < original.length; i += multiplier) {
        ret.push(original[Math.floor(i)]);
      }
      onComplete(ret);
    }


    var onBuffer = (buffer) => {
      // var source = context.createBufferSource();
      // console.info('Got the buffer', buffer);
      // source.buffer = buffer;
      // source.connect(context.destination);
      // source.loop = true;
      // source.start();

      resample(buffer, (resampled) => {
        var myWorker = new Worker(worker_script);

        myWorker.onmessage = (m) => {
            // console.log("msg from worker: ", m.data);
            this.setState(m.data);
        };
        myWorker.postMessage(resampled);

      });
    }

    var onDecodeBufferError = (e) => {
      console.log('Error decoding buffer: ' + e.message);
      console.log(e);
    }

    fetch(audioSrc, onSuccess);

  }

  onUploadClick = () => {
    this.setState({ showUploadModal: true })
  }

  handleDeleteModalHide = () => {
    this.setState({ showDeleteModal: false })
  }

  handleDeleteModalExited = () => {
    this.setState({ currentModalSong: null })
  }

  handleSpleetModalHide = () => {
    this.setState({ showSpleetModal: false })
  }

  handleSpleetModalExited = () => {
    this.setState({ currentModalSong: null })
  }

  handleUploadModalHide = () => {
    this.setState({ showUploadModal: false })
  }

  /**
   * Fetch song data from backend
   */
  loadData = async () => {
    axios
      .get('/api/source-track/')
      .then(({ data }) => {
        if (data) {
          this.setState({ songList: data })
        }
      })
      .catch(error => console.log('API errors:', error))
  }

  componentDidMount() {
    this.loadData()
    // Auto-refresh data every 30 seconds
    setInterval(this.loadData, 30000)
  }

  render() {
    const {
      songList,
      showDeleteModal,
      showSpleetModal,
      showUploadModal,
      currentSrcSong,
      currentSepSong,
      currentModalSong,
      isPlaying,
      task,
      expandedIds
    } = this.state
    const currentSong = currentSrcSong
      ? currentSrcSong
      : (currentSepSong
      ? currentSepSong
      : null)
    const currentSongUrl = currentSrcSong
      ? currentSrcSong.url
      : (currentSepSong
      ? currentSepSong.url
      : null)

    return (
      <div>
        <MyNavBar onUploadClick={this.onUploadClick} />
        <div className="jumbotron jumbotron-fluid bg-transparent">
          <div className="container secondary-color">
            <h2 className="display-5">Song List</h2>
            <p className="lead">Get started by uploading a song or separating an existing song.</p>
            {task && (
              <Alert variant="success">
                <span>
                  <a target="_blank" href={`/api/separate/${task.id}`}>{task.id}</a>:{' '}
                  {task.status}
                </span>
              </Alert>
            )}
            <ProgressBar now={this.state.crepe_progress / this.state.crepe_total * 100}/>
            <SongTable
              data={songList}
              currentSongUrl={currentSongUrl}
              isPlaying={isPlaying}
              expandedIds={expandedIds}
              onExpandRow={this.onExpandRow}
              onExpandAll={this.onExpandAll}
              onDeleteClick={this.onDeleteClick}
              onSpleetClick={this.onSpleetClick}
              onTabClick={this.onTabClick}
              onSepSongPauseClick={this.onSepSongPauseClick}
              onSepSongPlayClick={this.onSepSongPlayClick}
              onSrcSongPauseClick={this.onSrcSongPauseClick}
              onSrcSongPlayClick={this.onSrcSongPlayClick}
            />
          </div>
        </div>
        <MusicPlayer
          getAudioInstance={this.getAudioInstance}
          isSource={currentSrcSong}
          song={currentSong}
          onAudioPause={this.onAudioPause}
          onAudioPlay={this.onAudioPlay}
        />
        <UploadModal
          show={showUploadModal}
          hide={this.handleUploadModalHide}
          refresh={this.loadData}
        />
        <SpleetModal
          show={showSpleetModal}
          hide={this.handleSpleetModalHide}
          exit={this.handleSpleetModalExited}
          submit={this.onSpleetTaskSubmit}
          refresh={this.loadData}
          song={currentModalSong}
        />
        <DeleteModal
          show={showDeleteModal}
          hide={this.handleDeleteModalHide}
          exit={this.handleDeleteModalExited}
          refresh={this.loadData}
          song={currentModalSong}
        />
      </div>
    )
  }
}

export default Home
