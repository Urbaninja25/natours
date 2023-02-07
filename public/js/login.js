/* eslint-disable */
import axios from 'axios';

import { showAlert } from './alerts';

export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password,
      },
    });
    //!!!!!! res is response data here not result
    if (res.data.status === 'success') {
      //!!!!!!!!!!!!!!!!!!!
      showAlert('success', 'Logged in successfully!');

      window.setTimeout(() => {
        //in order to load new page we do that .after 1.5 sec it will load automatically
        location.assign('/');
      }, 1500);
    }
  } catch (err) {
    //if we are not successfull  we need to load these

    showAlert('error', err.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });

    if ((res.data.status = 'success')) location.assign('/');
  } catch (err) {
    console.log(err.response);
    showAlert('error', 'Error logging out! Try again.');
  }
};
