/* eslint global-require: 0*/
import React from 'react';
import PropTypes from 'prop-types';
import rimraf from 'rimraf';
import ConfigSchemaItem from './config-schema-item';
import WorkspaceSection from './workspace-section';
import SendingSection from './sending-section';
import { RetinaImg } from 'mailspring-component-kit';

class PreferencesGeneral extends React.Component {
  static displayName = 'PreferencesGeneral';

  static propTypes = {
    config: PropTypes.object,
    configSchema: PropTypes.object,
  };
  constructor(props) {
    super(props);
    this.state = {};
    this.state.displaySupportPopup = false;
    this.timer = null;
    this.mounted = false;
  }
  componentDidMount() {
    this.mounted = true;
  }
  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.timer);
  }

  _onReboot = () => {
    const app = require('electron').remote.app;
    app.relaunch();
    app.quit();
  };

  _renderActionIcon = (idx) => {
    const iconName = AppEnv.config.get(`core.quickActions.quickAction${idx}`);
    return (
      <RetinaImg
        name={`${iconName}.svg`}
        style={{ width: 24, height: 24 }}
        className={`action_icon action_${idx}`}
        isIcon
        mode={RetinaImg.Mode.ContentIsMask}
      />
    )
  }

  _onCopySupportId = event => {
    navigator.clipboard.writeText(this.props.config.core.support.id).then(() => {
      this.setState({ displaySupportPopup: true });
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          if (this.mounted) {
            this.setState({ displaySupportPopup: false });
          }
        }, 1600);// Same as popupFrames animation length
      }
    });
  };

  _onResetAccountsAndSettings = () => {
    rimraf(AppEnv.getConfigDirPath(), { disableGlob: true }, err => {
      if (err) {
        return AppEnv.showErrorDialog(
          `Could not reset accounts and settings. Please delete the folder ${AppEnv.getConfigDirPath()} manually.\n\n${err.toString()}`
        );
      }
      this._onReboot();
    });
  };

  _onResetEmailCache = () => {
    const ipc = require('electron').ipcRenderer;
    ipc.send('command', 'application:reset-database', {});
  };

  render() {
    return (
      <div className="container-general" style={{ maxWidth: 600 }}>
        <WorkspaceSection config={this.props.config} configSchema={this.props.configSchema} />

        <ConfigSchemaItem
          configSchema={this.props.configSchema.properties.notifications}
          keyName="Notifications"
          keyPath="core.notifications"
          config={this.props.config}
        />

        <div className="platform-note platform-linux-only">
          EdisonMail desktop notifications on Linux require Zenity. You may need to install it with
          your package manager (i.e., <code>sudo apt-get install zenity</code>).
        </div>

        <ConfigSchemaItem
          configSchema={this.props.configSchema.properties.reading}
          keyName="Reading"
          keyPath="core.reading"
          config={this.props.config}
        />

        <ConfigSchemaItem
          configSchema={this.props.configSchema.properties.composing}
          keyName="Composing"
          keyPath="core.composing"
          config={this.props.config}
        />

        <ConfigSchemaItem
          configSchema={this.props.configSchema.properties.quickActions}
          keyName="QuickActions"
          keyPath="core.quickActions"
          config={this.props.config}
          injectedComponent={
            <div className="quick-action-preview">
              <RetinaImg
                style={{ width: 500 }}
                name={`prefs-quick-actions.png`}
                mode={RetinaImg.Mode.ContentPreserve}
              />
              {this._renderActionIcon(1)}
              {this._renderActionIcon(2)}
              {this._renderActionIcon(3)}
              {this._renderActionIcon(4)}
            </div>
          }
        />

        <SendingSection config={this.props.config} configSchema={this.props.configSchema} />

        <ConfigSchemaItem
          configSchema={this.props.configSchema.properties.attachments}
          keyName="Attachments"
          keyPath="core.attachments"
          config={this.props.config}
        />

        <div className="local-data">
          <h6>Local Data</h6>
          <div className="btn" onClick={this._onResetEmailCache}>
            Reset Email Cache
          </div>
          <div className="btn" onClick={this._onResetAccountsAndSettings}>
            Reset Accounts and Settings
          </div>
        </div>

        <section className="support">
          <h6>Support Id</h6>
          <div className="popup" style={{ display: `${this.state.displaySupportPopup ? 'inline-block' : 'none'}` }}>ID Copied</div>
          <div className="btn" onClick={this._onCopySupportId}>{this.props.config.core.support.id}</div>
        </section>
      </div>
    );
  }
}

export default PreferencesGeneral;
