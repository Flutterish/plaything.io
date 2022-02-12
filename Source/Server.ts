import express from 'express';

const app = express();
const port = 8080;

app.use( '/', express.static( './../Files', { index: 'login', extensions: ['html'] } ) );

app.listen( port, () => {
	console.log( `Listening on port ${port}` );
} );