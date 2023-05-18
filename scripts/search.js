$(document).ready(function() { alert("test"); });

$(document).ready(function() {
    var egg = 'egg';
    var easter = '/easter-egg';
  
    $('body').html(function(i, html) {
      var regex = new RegExp(egg, 'gi');
      return html.replace(regex, function(match) {
        return '<a href="' + easter + '">' + match + '</a>';
      });
    });
  });
  