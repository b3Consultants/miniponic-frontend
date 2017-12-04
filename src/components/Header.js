import React from 'react';
import AppBar from 'material-ui/AppBar';
import FlatButton from 'material-ui/FlatButton';

const AppBarExampleIconButton = () => (
  <AppBar
    title={<span >Miniponic</span>}
    iconElementRight={
      <FlatButton label="Tank" />
    }
  />
);

export default AppBarExampleIconButton;
