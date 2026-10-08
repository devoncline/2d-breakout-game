const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#eeeeee';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.beginPath();
ctx.arc(240, 160, 10, 0, Math.PI * 2);
ctx.fillStyle = 'red';
ctx.fill();
ctx.closePath();