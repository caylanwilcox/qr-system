import React from 'react';
import QRCode from 'qrcode.react';

const QRCodeGenerator = ({ value }) => {
  return (
    <div>
      <QRCode value={value} />
    </div>
  );
};

export default QRCodeGenerator;
