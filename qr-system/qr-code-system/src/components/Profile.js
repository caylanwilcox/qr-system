import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig'; // Import Firebase config
import './Profile.css';

const Profile = () => {
  const [userData, setUserData] = useState(null);

  const getDataFromDatabase = () => {
    const userId = 'someUserId'; // Assume this is the user ID you want to fetch data for
    const dbRef = ref(database, `users/${userId}`); // Path to the user's data
    onValue(dbRef, (snapshot) => {
      const data = snapshot.val(); // Extract data snapshot
      setUserData(data); // Update the state with the fetched data
    });
  };

  useEffect(() => {
    getDataFromDatabase(); // Fetch data when component mounts
  }, []);

  return (
    <div className="profile-container">
      <h1>User Profile</h1>
      {userData ? (
        <div>
          <p>Name: {userData.name}</p>
          <p>Email: {userData.email}</p>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default Profile;
