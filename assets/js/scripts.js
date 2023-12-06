// random code snippet
function getRanNum(getLength, getExclued) {
    var ranNum = Math.floor(Math.random() * Number(getLength)) + 1;
    if (ranNum == getExclued) {
        console.log('--> SAME! <--');
    } else {
        console.log('--> ranNum/getExclued: ' + ranNum + '/' + getExclued + '; --> getLength: ' + getLength + ';');
    }
    return (ranNum == getExclued) ? getRanNum(getLength, getExclued) : ranNum;
}
$(document).ready(function (e) {
    var randLength = $('.code').length,
        thisItem = Number($('.code_box .code:visible').index()) + 1,
        randItem = getRanNum(randLength, thisItem) - 1;

    $('.code').hide();
    $('.code').eq(randItem).show();
});

// // gradient mouse
// (function ($) {
//     $(document).mousemove(
//         function (e) {
//             var X = e.pageX;
//             var Y = e.pageY;
//             $('.open').css('background', 'radial-gradient(circle at ' + X + 'px ' + Y + 'px, rgb(47, 49, 61), rgba(40,42,52,1))');
//         }
//     );
// })(jQuery);
