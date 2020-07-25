import React from 'react'
import { Button } from 'react-bootstrap'
import './RefreshButton.css'

/**
 * Tab button component, which triggers a source separation job.
 */
class RefreshButton extends React.Component {
  handleClick = () => {
    this.props.onClick(this.props.song)
  }

  render() {
    return (
      <Button variant="warning" className="tab-btn ml-2" onClick={this.handleClick}>
        Refresh
      </Button>
    )
  }
}

export default RefreshButton
