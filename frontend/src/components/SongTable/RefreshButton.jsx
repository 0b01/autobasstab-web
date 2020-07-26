import React from 'react'
import { Button, Spinner } from 'react-bootstrap'
import './RefreshButton.css'

/**
 * Tab button component, which triggers a source separation job.
 */
class RefreshButton extends React.Component {
  handleClick = () => {
    this.props.onClick(this.props.song)
  }

  render() {
    if (this.props.canRefresh || !this.props.tabbing) {
      return (
        <Button variant="warning" className="tab-btn ml-2" onClick={this.handleClick} disabled={!this.props.tabbing}>
          Refresh
        </Button>
      )
    } else {
      return (
        <Spinner animation="border" role="status">
          <span className="sr-only">Loading...</span>
        </Spinner>
      )
    }
  }
}

export default RefreshButton
