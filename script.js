const today = new Date();

const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
const fullDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

document.getElementById('dayName').textContent = dayName;
document.getElementById('fullDate').textContent = fullDate;