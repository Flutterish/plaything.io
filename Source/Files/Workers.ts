import type { ID } from "@Server/Api";

export const Workers = {
    get: <Treq, Tres, Tmessage, Theartbeat = void>( name: string, defaultHandler?: (data: Theartbeat) => any, intercept?: (data: Tres, res: (data: Tres) => any, rej: (err: any) => any) => any ) => {
        var worker = new Worker( name );
        var callbacks: { [id: number]: [(data: any) => any, (err: any) => any] } = {};
        var id = 0;

        worker.onmessage = msg => {
            if ( msg.data.id == undefined || callbacks[msg.data.id] == undefined ) {
                defaultHandler?.( msg.data as Theartbeat );
            }
            else {
                callbacks[msg.data.id][0]( msg.data );
                delete callbacks[msg.data.id];
            }
        };
        worker.onerror = msg => {
            console.error( msg );
        };
        worker.onmessageerror = msg => {
            console.error( msg );
        };

        return {
            request: <Trequest extends Treq = Treq, Tresponse extends Tres = Tres>( data: Trequest ): Promise<Tresponse> => {
                return new Promise( (res, rej) => {
                    (data as ID<Trequest>).id = id;
                    callbacks[id++] = [data => {
                        if ( intercept == undefined )
                            res(data);
                        else
                            intercept( data, res as any, rej );
                    }, rej];
                    worker.postMessage( data );
                } );
            },
            message: <Tmsg extends Tmessage>( data: Tmsg ) => {
                worker.postMessage( data );
            },

            mapRequests: <Tprop extends string, Treqq extends { [Key in Tprop]: string } & Treq, Tmap extends { [Key in Treqq[Tprop]]: Tres }>() => {
                return {
                    request: <Trequest extends Treqq>( data: Trequest ): Promise<Tmap[Trequest[Tprop]]> => {
                        return new Promise( (res, rej) => {
                            (data as ID<Trequest>).id = id;
                            callbacks[id++] = [data => {
                                if ( intercept == undefined )
                                    res(data);
                                else
                                    intercept( data, res as any, rej );
                            }, rej];
                            worker.postMessage( data );
                        } );
                    },
                    message: <Tmsg extends Tmessage>( data: Tmsg ) => {
                        worker.postMessage( data );
                    }
                };
            }
        };
    }
};