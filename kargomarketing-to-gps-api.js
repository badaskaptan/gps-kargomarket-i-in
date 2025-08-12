// Kargomarketing.com backend'inden GPS sistemine veri transferi
// NT250801210715 ilan numarası için

const gpsApiCall = {
  url: "https://rmqwrdeaecjyyalbnvbq.supabase.co/functions/v1/add-gps-task",
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    ilan_no: "NT250801210715",
    customer_info: "emrahbadas1980 (gezerholding) - 05412879705",
    delivery_address: "MERSIN",
    cargo_type: "vegetable_oils",
    loading_date: "2025-08-01",
    priority: "normal",
    api_key: "KARGOMARKETING_API_KEY_2025"
  })
};

// Browser Console Test Kodu:
fetch('https://rmqwrdeaecjyyalbnvbq.supabase.co/functions/v1/add-gps-task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ilan_no: "NT250801210715",
    customer_info: "emrahbadas1980 (gezerholding) - 05412879705",
    delivery_address: "MERSIN",
    cargo_type: "vegetable_oils",
    api_key: "KARGOMARKETING_API_KEY_2025"
  })
})
.then(res => res.json())
.then(data => console.log('GPS Transfer Result:', data))
.catch(err => console.error('Transfer Error:', err));
