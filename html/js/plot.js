async function plot(){
    const response = await fetch('./plot',{
        headers: {
            'Accept': 'application/json',
        },
        method: 'GET'
    })
}



const plot_button = document.getElementById('plot_button')
plot_button.addEventListener('click', () => {
    plot()
})