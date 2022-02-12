import express from 'express';

const app = express();
const port = 8080;

app.use( '/', express.static( './../Files' ) );

app.get( '/', (req, res) => {
	res.send( 'Hi mom!' );
} );

app.listen( port, () => {
	console.log( `Example app listening on port ${port}` );
} );