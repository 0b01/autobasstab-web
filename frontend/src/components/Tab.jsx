import React from 'react'
import { Button, Form } from 'react-bootstrap'
import './Tab.css'
import RefreshButton from './SongTable/RefreshButton'
const HOP_MS = 20; // has to be < 64

/**
 * Spleet button component, which triggers a source separation job.
 */
class Tab extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      bpm: 120,
      offset: 0.1,
    }
  }

  componentDidMount() {
    this.interval = setInterval(() => this.setState({ time: Date.now() }), 1000);
  }
  componentWillUnmount() {
    clearInterval(this.interval);
  }

  handleClick = (idx) => {
    this.props.audioInstance.currentTime = idx * HOP_MS / 1000;
  }

  build_txt = () => {
    let {tab} = this.props;
    let ret = [];
    if (tab.length === 0) return (<div></div>);
    let currentTime = this.props.audioInstance?.currentTime;

    let tab_clone = tab.slice();
    tab_clone.sort((a,b) => a.dur > b.dur ? 1 : -1);
    let dur_mode = tab_clone[Math.floor(tab_clone.length/2)].dur;

	  let beat_count = 0;


    for (var i=0; i < tab.length - 1; i++){
        let note = tab[i];
        let next = tab[i + 1];

        let txt = "";
        for (let i = 0; i < 4; i++) {
            txt += (note.string == (4-i-1) ? note.fret : "-");
        }
        if ((note.start+note.dur)*HOP_MS/1000 > (beat_count+1)*4*60/this.state.bpm + this.state.offset)
	    { ret.push("||||"); beat_count +=1; }
        ret.push(txt);

        let gap = next.start - note.start;
        let multiples = gap / dur_mode;
        for (let i = 0; i < Math.ceil(Math.max(1, multiples)); i++) {
            let txt = "----";
            let t = note.start + i * dur_mode;
            ret.push(txt)
	    if (t*HOP_MS/1000 > (beat_count+1)*4*60/this.state.bpm + this.state.offset)
	    { ret.push("||||"); beat_count +=1; }
        }
    }
    let transposed = "";
    for (var i=0; i < 4; i++) {
      for (var j=0; j < ret.length; j++){
        transposed += ret[j][i];
	if ( j == ret.length-1) { transposed += "\n"; }
      }
    }
    return transposed;
  };

  onDownload = () => {
    let text = this.build_txt();
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "tab.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  changeBPM = (bpm) => {
    this.setState({bpm: bpm.target.value})
  }

  changeOffset = (offset) => {
    this.setState({offset: offset.target.value})
  }

  render() {
	  let refresh_btn = (<RefreshButton onClick={this.props.onRefresh} canRefresh={this.props.canRefresh} tabbing={this.props.tabbing} />);
    let {tab} = this.props;
    let ret = [];
    if (tab.length === 0) return (<div>
	    {refresh_btn}
	    </div>);
    let currentTime = this.props.audioInstance?.currentTime;

    let tab_clone = tab.slice();
    tab_clone.sort((a,b) => a.dur > b.dur ? 1 : -1);
    let dur_mode = tab_clone[Math.floor(tab_clone.length/2)].dur;

    let beat_count = 0;
    for (var i=0; i < tab.length - 1; i++){
        let note = tab[i];
        let next = tab[i + 1];

        let txt = "";
        for (let i = 0; i < 4; i++) {
	    let empty = (note.fret).toString().length == 2  ? "--\n" : "-\n";
            txt += (note.string == (4-i-1) ? note.fret + "\n" : empty);
        }

	    if ((note.start+note.dur)*HOP_MS/1000 > (beat_count+1)*4*60/this.state.bpm + this.state.offset)
              {
		    ret.push(<pre className={"tabColumn " + (note.start * HOP_MS / 1000 < currentTime ? "past" : "")} key={note.start + i + "bar"} onClick={() => this.handleClick(t)}>{"|\n|\n|\n|\n"}</pre>)
		    beat_count += 1;
              }

        ret.push(<pre className={"tabColumn " + (note.start * HOP_MS / 1000 < currentTime ? "past" : "")} key={note.start + " " +note.dur} onClick={() => this.handleClick(note.start)}>{txt}</pre>);

        let gap = next.start - note.start;
        let multiples = gap / dur_mode;
        for (let i = 0; i < Math.ceil(Math.max(1, multiples)); i++) {
            let txt = "-\n-\n-\n-\n";
            let t = note.start + i * dur_mode;
            ret.push(<pre className={"tabColumn " + (t * HOP_MS / 1000 < currentTime ? "past" : "")} key={note.start + i + "gap"} onClick={() => this.handleClick(t)}>{txt}</pre>)
	    if (t*HOP_MS/1000 > (beat_count+1)*4*60/this.state.bpm + this.state.offset)
              {
		    ret.push(<pre className={"tabColumn " + (t * HOP_MS / 1000 < currentTime ? "past" : "")} key={note.start + i + "gap" + "bar"} onClick={() => this.handleClick(t)}>{"|\n|\n|\n|\n"}</pre>)
		beat_count += 1;
              }

        }

        // bpm = bpm beat/minute
        // 1 hyphen = dur_mode * HOP_MS / 1000 seconds
	// 4*60/bpm * dur_mode * HOP_MS / 1000 hyphens = 4*60/bpm seconds = 4 beats = bar
    }

    return (
        <div>
         {ret}
	  <br/>
	    <Form>
	      <Form.Group controlId="formBasicEmail">
	        <Form.Label>BPM</Form.Label>
	        <Form.Control type="number" placeholder="BPM" onChange={this.changeBPM} value={this.state.bpm} />
	        <Form.Label>Offset (seconds)</Form.Label>
	        <Form.Control type="number" placeholder="beat offset" onChange={this.changeOffset} value={this.state.offset}/>
	      </Form.Group>
	    </Form>

          {refresh_btn}
          <Button onClick={this.onDownload}>Download</Button>
          
        </div>
    );
  }
}

export default Tab
