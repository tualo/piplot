const plot_button = document.getElementById('plot_button')
const plot_message = document.getElementById('plot_message')

async function plot(){
    plot_button.disabled=true;
    plot_message.innerHTML="Der Plot läuft ...";
    plot_message.className.replaceAll('alert alert-primary')

    const response = await fetch('./plot',{
        headers: {
            'Accept': 'application/json',
        },
        method: 'GET'
    });

    if (response.success){
        plot_message.innerHTML="Der Plot ist abgeschossen";
        plot_message.className.replaceAll('alert alert-success')
    }else{
        plot_message.innerHTML="Der Plot schlug fehl";
        plot_message.className.replaceAll('alert alert-danger')
    }


    plot_button.disabled=false;

}



plot_button.addEventListener('click', () => {
    plot()
})