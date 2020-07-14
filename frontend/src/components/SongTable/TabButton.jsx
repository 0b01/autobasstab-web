import React from 'react'
import { Button } from 'react-bootstrap'
import './TabButton.css'

/**
 * Tab button component, which triggers a source separation job.
 */
class TabButton extends React.Component {
  handleClick = () => {
    this.props.onClick(this.props.song)
  }

  render() {
    return (
      <Button variant="warning" className="tab-btn ml-2" onClick={this.handleClick}>
        Tab
      </Button>
    )
  }
}

export default TabButton
