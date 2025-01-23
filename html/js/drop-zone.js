const dropZone = document.getElementById('upload_dropZone')
const formFile = document.getElementById('upload_file')

dropZone.addEventListener('click', () => formFile.click())

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropZone.classList.add('bg-light')
})

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('bg-light')
})

dropZone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropZone.classList.remove('bg-light')
  formFile.files = e.dataTransfer.files
  updateDropZoneText()
})

formFile.addEventListener('change', updateDropZoneText)

function updateDropZoneText() {
  dropZone.textContent =
    formFile.files.length > 0
      ? formFile.files[0].name
      : 'Drag and drop a file here or click to select'

  console.log(formFile.files[0]);

  const reader = new FileReader();

    reader.addEventListener('load', (event) => {
        sendFile(event.target.result);
    });
    reader.readAsDataURL(formFile.files[0]);

}

async function sendFile(data) {
    const response = await fetch('./file',{
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
        method: 'POST',
        body: JSON.stringify({
            data: data
        })
    })
    const json = await response.json();
    console.log(
      Math.round((json.info.maxx-json.info.minx)/40),
      Math.round((json.info.maxy-json.info.miny)/40)
    )
    
    // hpglViewer.setMachineTravelWidth( Math.round((json.info.maxx-json.info.minx)/40));
    // hpglViewer.setMachineTravelHeight( Math.round((json.info.maxy-json.info.miny/40) )) ;
    
    hpglViewer.draw(json.hpgl);
}