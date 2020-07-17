import React, { Component } from 'react'
import axios from 'axios'
import { Alert, ProgressBar, Button } from 'react-bootstrap'
import MusicPlayer from './MusicPlayer'
import MyNavBar from './MyNavBar'
import SongTable from './SongTable/SongTable'
import DeleteModal from './SongTable/DeleteModal'
import SpleetModal from './SongTable/SpleetModal'
import UploadModal from './Upload/UploadModal'
import Tab from './Tab'
import * as tf from '@tensorflow/tfjs';
import { buffer } from '@tensorflow/tfjs'
// import CrepeWorker from "./spice.js";
import CrepeWorker from "./crepe.js";
import PitchShiftWorker from "./pitchshift.js";
import * as LPF from "low-pass-filter";

const TEST = false;
const TEST_SECONDS = 10;
const PLAY = false;
const USE_UNMIXED = false;

function qsToJson(qs) {
  var res = {};
  var pars = qs.split('&');
  var kv, k, v;
  for (i in pars) {
    kv = pars[i].split('=');
    k = kv[0];
    v = kv[1];
    res[k] = decodeURIComponent(v);
  }
  return res;
}

async function get_youtube_info(id, callback) {
  var url = 'https://www.youtube.com/get_video_info?html5=1&video_id=' + id;
  let page = await fetch(url);
  var get_video_info = qsToJson(body);

  // remapping urls into an array of objects
  var tmp = get_video_info["url_encoded_fmt_stream_map"];
  if (tmp) {
    tmp = tmp.split(',');
    for (i in tmp) {
      tmp[i] = qsToJson(tmp[i]);
    }
    get_video_info["url_encoded_fmt_stream_map"] = tmp;
  }
  return get_video_info;
}


/**
 * Home component where main functionality happens, consisting of the main nav bar
 * and the song table.
 */
class Home extends Component {
  constructor(props) {
    super(props)
    this.state = {
      tab: [],
      pitchshift_total: 0,
      pitchshift_progress: 0,
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

  onTabClick = async (song) => {
    console.log(song);
    // let info = await get_youtube_info("ml-v1bgMJDQ");
    // console.log(info);
    // return 0;

    var context = new (window.AudioContext || window.webkitAudioContext)();
    let audioSrc;
    if (USE_UNMIXED) {
      audioSrc = (() => {
        console.log(song);
        for (let t of song.processed) {
          if (t?.bass && !t.other && !t.drums && !t.vocals) {
            return t.url;
          }
        }
      })();
    } else {
      audioSrc = song.url;
    }
    console.log(audioSrc);

    // perform resampling the audio to 16000 Hz, on which the model is trained.
    // setting a sample rate in AudioContext is not supported by most browsers at the moment.
    var resample = (audioBuffer) => {
      const multiplier = audioBuffer.sampleRate / 16000;
      const original = audioBuffer.getChannelData(0);
      var ret = [];
      var i;
      for (i = 0; i < original.length; i += multiplier) {
        ret.push(original[Math.floor(i)]);
      }
      return ret;
    }

    let audio = await fetch(audioSrc);
    var audioData = await audio.arrayBuffer();
    let buffer = await context.decodeAudioData(audioData);

    let shifted = await new Promise(resolve => {
        let pitchshift_worker = new Worker(PitchShiftWorker);
        pitchshift_worker.onmessage = (m) => {
          this.setState(m.data);
          if (m.data.hasOwnProperty("pitchshift_result")) {
            let result = m.data.pitchshift_result;
            LPF.lowPassFilter(buf, 200, buffer.sampleRate, 1);
            resolve(result);
          }
        };
        let buf = buffer.getChannelData(0)
        if (TEST) {
          buf = buf.subarray(0, buffer.sampleRate * TEST_SECONDS);
        }

        LPF.lowPassFilter(buf, 100, buffer.sampleRate, 1);
        pitchshift_worker.postMessage({
          buf,
          sampleRate: buffer.sampleRate,
        });
      });

    // LPF.lowPassFilter(shifted, 300, buffer.sampleRate, 1);
    buffer.copyToChannel(shifted, 0, 0);
    buffer.copyToChannel(shifted, 1, 0);

    if (PLAY) {
      let a = new Audio();
      let audioCtx = new AudioContext();
      let source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }


    let resampled = resample(buffer);
    let myWorker = new Worker(CrepeWorker);
    myWorker.onmessage = (m) => {
        this.setState(m.data);
        if (m.data.hasOwnProperty("crepe_result")) {
          let pitch_track = m.data.crepe_result;
          let {arrangement, track} = this.run_notes(pitch_track);
          let tab = [];
          let i = 0, j = 0;
          let start = 0;
          while (i < arrangement.length && j < track.length) {
              let string = arrangement[i++];
              let fret = arrangement[i++];
              let freq = track[j++];
              let start = track[j++];
              let dur = track[j++];
              tab.push({string, fret, start, dur});
          }
          this.setState({tab});
        }
    };
    if (TEST) {
      resampled = resampled.slice(0, 16000 * TEST_SECONDS);
    }
    myWorker.postMessage(resampled);


  }

  run_notes = (crepe_result) => {
    let get_notes = Module.cwrap("get_notes", 'number', ['number', 'number', 'number', 'number']);

    function transferToHeap(arr) {
      const floatArray = toFloatArr(arr);
      let heapSpace = Module._malloc(floatArray.length *
                          floatArray.BYTES_PER_ELEMENT); // 1
      Module.HEAPF32.set(floatArray, heapSpace >> 2); // 2
      return heapSpace;
      function toFloatArr(arr) {
        const res = new Float32Array(arr.length); // 3
          for (let i=0; i < arr.length; i++)
              res[i] = arr[i];
          return res;
      }
    }

    function gn(freq, lvl) {
      let arrayOnHeap; // 4.
      try {
          let f = transferToHeap(freq);
          let l = transferToHeap(lvl);
          let o = transferToHeap(new Array(freq.length * 3).fill(0));
          console.log(o);
          let ret_sz = get_notes(o, lvl.length, l, f);
          console.log(ret_sz);
          return Module.HEAPF32.subarray((o>>2), (o>>2) + ret_sz);
      } finally {
      // Module._free(arrayOnHeap); // 5.
      }
    }

    let track = gn(crepe_result.freq, crepe_result.level);
    let mut_arrangement = new Uint8Array(track.length / 3 * 2).fill(22);
    frets(-12, mut_arrangement, track);

    return {arrangement: mut_arrangement, track};
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
            {/* <h2 className="display-5">Song List</h2>
            <p className="lead">Get started by uploading a song or separating an existing song.</p> */}
            {task && (
              <Alert variant="success">
                <span>
                  <a target="_blank" href={`/api/separate/${task.id}`}>{task.id}</a>:{' '}
                  {task.status}
                </span>
              </Alert>
            )}
            <Tab tab={this.state.tab} audioInstance={this.state.audioInstance} />
            <ProgressBar now={this.state.pitchshift_progress / this.state.pitchshift_total * 100} label={"" + this.state.pitchshift_progress +"/"+ this.state.pitchshift_total + ""}/>
            <ProgressBar now={this.state.crepe_progress / this.state.crepe_total * 100} label={""+this.state.crepe_progress +'/'+ this.state.crepe_total+""}/>
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
