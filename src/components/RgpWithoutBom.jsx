import React from 'react';
import FabricRgpForm from './rgp';

export default function RgpWithoutBom({ currentUser, onNavigate }) {
  return (
    <FabricRgpForm
      initialMode="without_bom"
      currentUser={currentUser}
      onBack={() => {
        if (onNavigate) {
          onNavigate('rgp');
        }
      }}
    />
  );
}
