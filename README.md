# able-up
AbleUp

A job search web app that helps people with disabilities find remote work. It flags postings that mention inclusion or accommodations, and has accessibility controls (text size, high contrast, keyboard and screen-reader support).

Demo video: <link>
Live (load balancer): http://<LB01_IP>
API keys / credentials: none needed. The app uses Remotive's free public API and has no login.
Features

Search by title, skill, employer or tag; filter by region, job type and "inclusion signals"; sort; the server downloads the job feed once and caches it for 6 hours; graceful errors (timeout, rate limit, bad response); serves saved results if the feed is temporarily down.

API credit

Job data: Remotive Remote Jobs API (https://remotive.com/api/remote-jobs). Jobs are delayed 24 hours per Remotive's terms, and each job links back to Remotive. Built with Express and dotenv.
Run locally
git clone https://github.com/berylrwagatare/able-up.git
cd ableup
npm install
npm start                # http://localhost:3000
Deploy on Web01 and Web02
bash
sudo apt update && sudo apt install -y nodejs npm git
git clone <your-repo> ~/ableup && cd ~/ableup && npm install
sudo npm i -g pm2 && pm2 start server.js --name ableup && pm2 save && pm2 startup
curl localhost:3000/health
Configure Lb01 (HAProxy)
bash
sudo apt install -y haproxy

Append to /etc/haproxy/haproxy.cfg:

frontend http_in
    bind *:80
    default_backend ableup_servers

backend ableup_servers
    balance roundrobin
    option httpchk GET /health
    server web01 <WEB01_IP>:3000 check
    server web02 <WEB02_IP>:3000 check
bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl restart haproxy
Testing the balancing
bash
for i in 1 2 3 4; do curl -s http://<LB01_IP>/health; echo; done

The server value alternates between the two hostnames. X-Served-By is also on every response.

