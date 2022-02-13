var flexFont = function () {
    var divs = document.getElementsByClassName("font-icon");
    for(var i = 0; i < divs.length; i++) {
        var style = window.getComputedStyle(divs[i]);
        var height = Number.parseFloat( style.height );
        var pt = Number.parseFloat( style.paddingTop );
        var pb = Number.parseFloat( style.paddingBottom );
        divs[i].style.fontSize = ( height - pt - pb ) + 'px'; 
    }
};

window.onload = function(event) {
    flexFont();
};
window.onresize = function(event) {
    flexFont();
};