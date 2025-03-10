
document.addEventListener('DOMContentLoaded', function() {
    const cityButtons = document.querySelectorAll('.ciutat-btn');
    const videoSection = document.getElementById('videoSection');
    const videoIframe = document.getElementById('videoIframe');
    const closeVideo = document.getElementById('closeVideo');
  
    cityButtons.forEach(button => {
      button.addEventListener('click', function(event) {
        event.preventDefault();
  
        let city = button.classList[1];
        let videoURL = '';
  
        // Actualizar las URLs del switch
        switch(city) {
          case 'madrid':
            videoURL = 'https://www.youtube.com/embed/eGDOeMCViCo';
            break;
          case 'barcelona':
            videoURL = 'https://www.youtube.com/embed/eGDOeMCViCo';
            break;
          case 'valencia':
            videoURL = 'https://www.youtube.com/embed/eGDOeMCViCo';
            break;
          case 'palma':
            videoURL = 'https://www.youtube.com/embed/eGDOeMCViCo';
            break;
          default:
            videoURL = '';
        }
  
        // Assignar la URL al iframe i mostrar la secció del vídeo
        videoIframe.src = videoURL;
        videoSection.style.display = 'flex';
      });
    });
  
    closeVideo.addEventListener('click', function() {
      videoSection.style.display = 'none';
      videoIframe.src = '';
    });
  });
  