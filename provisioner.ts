import axios from 'axios';

const HUB_URL = 'https://berrysmart.games'

const code = `
    boolean isPrime(int n) {
        for (int i = 2; i <= Math.sqrt(n); i++)
            if (n % i == 0)
                return false;
        return n > 1;
    }
`

axios.post(`${HUB_URL}/upload?name=prime&method=isPrime`, code, { headers: { 'Content-Type': 'text/plain' } })
    .then(_res => {
        for (let n = 0; n < 100; n++) {
            axios.get(`${HUB_URL}/invoke?name=prime&args=${n}`)
                .then(res => {
                    if (res.data == true) {
                        console.log(n);
                    } else if (res.data != false) {
                        console.log(res.data)
                    }
                });
        }
    });
