export function fitFont ( parent: HTMLElement ) {
    for ( const div of parent.querySelectorAll( '.font-icon' ) ) {
        var style = window.getComputedStyle( div );
        var height = Number.parseFloat( style.height );
        var pt = Number.parseFloat( style.paddingTop );
        var pb = Number.parseFloat( style.paddingBottom );
        (div as HTMLElement).style.fontSize = ( height - pt - pb ) + 'px'; 
    }
};

export function createTemplate ( data: string ): HTMLElement {
    var root = document.createElement( 'div' );
    root.innerHTML = data;
    
    return root;
}