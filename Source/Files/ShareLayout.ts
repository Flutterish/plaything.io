import type { Control } from '@Server/Device';

type Size = { width: number, height: number };
type Position = { x: number, y: number };
export function computeLayout<T extends Size> ( items: T[], availableWidth: number, gap = 0 ) {
    type Tresult = { item: T } & Position;
    var result: Tresult[] = [];

    var currentLine: Tresult[] = [];
    var currentMain = 0;
    var currentCross = 0;

    function finalizeLine () {
        var lineMain = currentLine[ currentLine.length - 1 ].x + currentLine[ currentLine.length - 1 ].item.width;
        var freeMain = availableWidth - lineMain;

        var lineCross = 0;
        for ( const item of currentLine ) {
            item.x += freeMain / 2;
            lineCross = Math.max( lineCross, item.item.height );
        }

        for ( const item of currentLine ) {
            item.y += ( lineCross - item.item.height ) / 2;
        }

        currentCross += lineCross + gap;
        currentMain = 0;
        result.push( ...currentLine );
        currentLine = [];
    }

    for ( const item of items ) {
        if ( items.length > 0 && currentMain + item.width > availableWidth ) {
            finalizeLine();
        }

        var current: Tresult = { item: item, x: currentMain, y: currentCross };
        currentLine.push( current );
        currentMain += item.width + gap;
    }

    finalizeLine();

    return result;
}

export function fitAspectRatio ( input: Size, target: Size ): Size {
    if ( input.width / input.height > target.width / target.height ) {
        return {
            width: target.width,
            height: input.height / input.width * target.width
        };
    }
    else {
        return {
            width: input.width / input.height * target.height,
            height: target.height
        };
    }
}

export function computeSharedLayout<T extends Size> ( availableSize: Size, sharedSize: Size, items: T[], gap = 0 ) {
    var screenFit = fitAspectRatio( sharedSize, availableSize );
    var scale = screenFit.width / sharedSize.width;

    var layout = computeLayout( items, sharedSize.width, gap );
    // TODO also scale verticaly if needed. for now we always have infinite height so it doesnt matter

    return {
        unscaledLayout: layout,
        scale: scale,
        width: screenFit.width,
        height: layout.reduce( (y, item) => Math.max( y, item.y + item.item.height ), 0 ) * scale
    };
}

const unknownSize = { width: 0, height: 0 };
const buttonSize = { width: 40, height: 40 };
const verticalSliderSize = { width: 36, height: 90 };

export function computeSharedControlLayout ( availableSize: Size, controls: Control.Any[] ) {
    var items: ({ control: Control.Any } & Size)[] = [];
    for ( const control of controls ) {
        var size = control.type == 'button'
            ? buttonSize
            : control.type == 'slider'
            ? control.orientation == 'vertical'
                ? verticalSliderSize
                : unknownSize
            : unknownSize;

        items.push( {
            control: control,
            width: size.width,
            height: size.height
        } );
    }

    var result: ({ control: Control.Any } & Size & Position)[] = [];
    var layout = computeSharedLayout( availableSize, { width: 100 * 4 / 3, height: 100 }, items, 5 );
    var screenFit = fitAspectRatio( { width: 100 * 4 / 3, height: 100 }, availableSize );

    for ( const item of layout.unscaledLayout ) {
        result.push( {
            control: item.item.control,
            width: item.item.width * layout.scale,
            height: item.item.height * layout.scale,
            x: item.x * layout.scale + ( availableSize.width - layout.width ) / 2,
            y: item.y * layout.scale + ( layout.height < screenFit.height ? ( screenFit.height - layout.height ) / 2 : 0 )
        } );
    }


    return {
        items: result,
        width: layout.width,
        height: Math.max( layout.height, screenFit.height ),

        normalWidth: layout.width,
        normalHeight: screenFit.height
    };
}