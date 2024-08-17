import React, { useState } from 'react';
import QRCode from 'qrcode.react';
import './QrBadge.css';

const QrBadge = () => {
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [showBadge, setShowBadge] = useState(false);

  const qrCodeValue = `${name}|${birthday}`;

  const handleGenerate = () => {
    setShowBadge(true);
  };

  return (
    <div className="qr-badge-container">
      <h1>Generate QR Badge</h1>
      <div className="form-group">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter Name"
        />
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          placeholder="Enter Birthday"
        />
        <button onClick={handleGenerate}>Generate QR Badge</button>
      </div>
      {showBadge && (
        <div className="badge" id="badge">
          <h2>Employee Badge</h2>
          <p>Name: {name}</p>
          <p>Birthday: {birthday}</p>
          <QRCode value={qrCodeValue} />
          <button onClick={() => window.print()}>Print Badge</button>
        </div>
      )}
    </div>
  );
};

export default QrBadge;
