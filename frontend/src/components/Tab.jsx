import React from 'react'
import { Button } from 'react-bootstrap'
import './Tab.css'

const HOP_MS = 20; // has to be < 64

/**
 * Spleet button component, which triggers a source separation job.
 */
class SpleetButton extends React.Component {
  constructor(props) {
    super(props);
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

  render() {
    let {tab} = this.props;
    let ret = [];
    if (tab.length === 0) return (<div></div>);
    let currentTime = this.props.audioInstance?.currentTime;

    let tab_clone = tab.slice();
    tab_clone.sort((a,b) => a.dur > b.dur ? 1 : -1);
    let dur_mode = tab_clone[Math.floor(tab_clone.length/2)].dur;


    for (var i=0; i < tab.length - 1; i++){
        let note = tab[i];
        let next = tab[i + 1];

        let txt = "";
        for (let i = 0; i < 4; i++) {
            txt += (note.string == (4-i-1) ? note.fret + "\n" : "-\n");
        }
        ret.push(<pre className={"tabColumn " + (note.start * HOP_MS / 1000 < currentTime ? "past" : "")} key={note.start} onClick={() => this.handleClick(note.start)}>{txt}</pre>);

        let gap = next.start - note.start;
        let multiples = gap / dur_mode;
        for (let i = 0; i < Math.ceil(Math.max(1, multiples)); i++) {
            let txt = "-\n-\n-\n-\n";
            let t = note.start + i * dur_mode;
            ret.push(<pre className={"tabColumn " + (t * HOP_MS / 1000 < currentTime ? "past" : "")} key={note.start + i + "gap"} onClick={() => this.handleClick(t)}>{txt}</pre>)
        }
    }

    return (
        ret
    );
  }
}

export default SpleetButton
