/* eslint-disable */

export const hideAlert = () => {
  const el = document.querySelector('.alert');
  //js trick ,- move one level up to the parent element and then from there remove a child
  if (el) el.parentElement.removeChild(el);
};

// type is 'success' or 'error'
export const showAlert = (type, msg) => {
  //თავის დაზღვევის მიზნით გავთიშოტ alert თუ გვაქვქ უკვე ალერთ რათა გამოვსახოთ current alert
  hideAlert();
  const markup = `<div class="alert alert--${type}">${msg}</div>`;
  document.querySelector('body').insertAdjacentHTML('afterbegin', markup);
  window.setTimeout(hideAlert, 5000);
};
