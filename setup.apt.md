sudo apt update
sudo apt install nodejs
sudo apt install npm
sudo apt install pstoedit
sudo apt install -y bc git dkms build-essential raspberrypi-kernel-headers

cd /home/plotter/
git clone https://github.com/tualo/piplot
cd piplot
npm i
cp plotter.service /lib/systemd/system/plotter.service