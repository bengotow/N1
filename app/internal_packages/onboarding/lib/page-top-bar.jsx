import React from 'react';
import PropTypes from 'prop-types';
import { AccountStore } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import OnboardingActions from './onboarding-actions';

const PageTopBar = props => {
  const { pageDepth } = props;
  const closeAction = () => {
    if (AccountStore.accounts().length === 0) {
      AppEnv.quit();
    } else {
      AppEnv.close();
    }
  };
  const backAction = () => {
    const webview = document.querySelector('webview');
    if (webview && webview.canGoBack()) {
      webview.goBack();
    } else if (pageDepth > 1) {
      OnboardingActions.moveToPreviousPage();
    }
  };

  let closeButton = (
    <div className='close' onClick={closeAction}>
      <RetinaImg name='onboarding-close.png' mode={RetinaImg.Mode.ContentPreserve} />
    </div>
  );

  let backButton = (
    <div className='back' onClick={backAction}>
      <RetinaImg name='onboarding-back.png' mode={RetinaImg.Mode.ContentPreserve} />
    </div>
  );

  if (!props.allowMoveBack) {
    backButton = null;
  }
  return (
    <div
      className="dragRegion"
      style={{
        top: 0,
        left: 26,
        right: 0,
        height: 27,
        zIndex: 100,
        position: 'absolute',
        WebkitAppRegion: 'drag',
      }}
    >
      {closeButton}
      {backButton}
    </div>
  );
};

PageTopBar.propTypes = {
  pageDepth: PropTypes.number,
  allowMoveBack: PropTypes.bool,
};

export default PageTopBar;
