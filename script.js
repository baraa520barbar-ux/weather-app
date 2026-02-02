// تعريف المتغيرات الأساسية للوصول لعناصر HTML
const cityInput = document.getElementById('cityInput');
const searchbtn = document.getElementById('searchBtn');

// متغيرات عالمية لتخزين آخر بيانات عشان نستخدمها عند تغيير وحدة القياس (C/F)
let lastWeatherData = null;
let lastCityName = "";

// حدث الضغط على زر البحث
searchbtn.addEventListener("click", () => {
    const cityName = cityInput.value.trim();
    if (cityName !== "") {
        getGeoData(cityName);
    } else {
        alert("Please enter a city name");
    }
});

// 1. وظيفة الحصول على إحداثيات المدينة (Latitude & Longitude)
async function getGeoData(cityName) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            alert("City not found");
            return;
        }

        const { latitude, longitude } = data.results[0];
        
        // طلب بيانات الطقس بناءً على الإحداثيات
        const weatherInfo = await getWeatherData(latitude, longitude); 
        
        if (weatherInfo) {
            updateUI(weatherInfo, cityName);
            loadDailyForecast(weatherInfo.daily);
        }

    } catch (error) {
        console.error("Geocoding Error: " + error);
    }
}

// 2. وظيفة جلب بيانات الطقس من API
async function getWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,apparent_temperature&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        
        const resultWeather = await response.json();
        return resultWeather;
    } catch (error) {
        console.error("Weather API Error: " + error.message);
    }
}

// 3. تحديث واجهة المستخدم الرئيسية
function updateUI(data, cityName, unit = "C") {
    lastWeatherData = data;
    lastCityName = cityName;

    document.getElementById('dvCityCountry').innerText = cityName;
    document.getElementById('dvCurrDate').innerText = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
    });

    let temp = data.current.temperature_2m;
    let feelsLike = data.current.apparent_temperature;

    // تحويل الوحدة لو المستخدم اختار فهرنهايت
    if (unit === "F") {
        temp = (temp * 9/5) + 32;
        feelsLike = (feelsLike * 9/5) + 32;
    }

    document.getElementById('dvCurrTemp').innerText = Math.round(temp);
    document.getElementById('pFeelsLike').innerText = Math.round(feelsLike);
    document.getElementById('pHumidity').innerText = data.current.relative_humidity_2m;
    document.getElementById('pWind').innerText = data.current.wind_speed_10m + " km/h";
    document.getElementById('pPrecipitation').innerText = data.current.precipitation + " mm";

    // تحديث الأيقونة بناءً على كود الطقس (أدق من الحرارة)
    const weatherIcon = document.querySelector('.current__icon');
    const status = getWeatherCodeName(data.current.weather_code);
    weatherIcon.src = `/assets/images/icon-${status}.webp`;

    setupHourlyDropdown(data); // تعبئة الـ Select بالـ 7 أيام
    displayHourlyData(data, 0);
}

// 4. وظيفة بناء عناصر التوقعات اليومية
function loadDailyForecast(dailyData) {
    for (let i = 0; i < 7; i++) {
        let date = new Date(dailyData.time[i]);
        let dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
        let dvForecastDay = document.querySelector(`#dvForecastDay${i + 1}`);
        
        if (!dvForecastDay) continue;

        let status = getWeatherCodeName(dailyData.weather_code[i]);
        let dailyHigh = Math.round(dailyData.temperature_2m_max[i]) + "°";
        let dailyLow = Math.round(dailyData.temperature_2m_min[i]) + "°";

        // مسح المحتوى القديم
        dvForecastDay.innerHTML = "";

        // استخدام الـ Helper function لإضافة العناصر
        addDailyElement("p", "daily__day-title", dayOfWeek, "", dvForecastDay, "afterbegin");
        addDailyElement("img", "daily__day-icon", "", status, dvForecastDay, "beforeend");
        
        const dvTemps = document.createElement("div");
        dvTemps.className = "daily__day-temps";
        dvForecastDay.appendChild(dvTemps);

        addDailyElement("p", "daily__day-high", dailyHigh, "", dvTemps, "afterbegin");
        addDailyElement("p", "daily__day-low", dailyLow, "", dvTemps, "beforeend");
    }
}

// 5. دالة مساعدة لإنشاء عناصر HTML (كانت ناقصة عندك)
function addDailyElement(tag, className, text, iconName, parent, position) {
    const el = document.createElement(tag);
    el.className = className;
    if (tag === "img") {
        el.src = `/assets/images/icon-${iconName}.webp`;
        el.alt = iconName;
    } else {
        el.innerText = text;
    }
    
    if (position === "afterbegin") {
        parent.prepend(el);
    } else {
        parent.appendChild(el);
    }
}

// 6. تحويل أكواد Open-Meteo لأسماء صور
function getWeatherCodeName(code) {
    if (code === 0) return 'sunny';
    if ([1, 2, 3].includes(code)) return 'partly-cloudy';
    if ([45, 48].includes(code)) return 'fog';
    if ([51, 53, 55, 61, 63, 65].includes(code)) return 'rainy';
    if ([71, 73, 75].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'storm';
    return 'sunny';
}

// 7. مستمع تغيير الوحدات
document.getElementById('ddlUnits').addEventListener('change', (e) => {
    const selectedUnit = e.target.value;
    if (lastWeatherData && selectedUnit !== "") {
        updateUI(lastWeatherData, lastCityName, selectedUnit);
    }
});

// 1. دالة لتعبئة الـ Dropdown بالـ 7 أيام القادمة
function setupHourlyDropdown(data) {
    const ddlDay = document.getElementById('ddlDay');
    ddlDay.innerHTML = ""; // مسح القديم

    data.daily.time.forEach((dateStr, index) => {
        const date = new Date(dateStr);
        const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
        
        const option = document.createElement('option');
        option.value = index; // هنستخدم الـ index عشان نعرف نختار الساعات
        option.innerText = index === 0 ? "Today" : dayName;
        ddlDay.appendChild(option);
    });

    // إضافة حدث عند تغيير اليوم من الـ Dropdown
    ddlDay.onchange = (e) => {
        displayHourlyData(data, e.target.value);
    };
}

// 2. دالة لعرض بيانات الساعات بناءً على اليوم المختار
function displayHourlyData(data, dayIndex) {
    const hourlyData = data.hourly;
    const startIndex = dayIndex * 24; // بداية الساعات لليوم المختار
    const endIndex = startIndex + 24; // نهاية الساعات (24 ساعة)

    for (let i = 0; i < 24; i++) {
        const currentHourIndex = startIndex + i;
        const dvHour = document.getElementById(`dvForecastHour${i + 1}`);
        
        if (!dvHour) continue;

        const time = new Date(hourlyData.time[currentHourIndex]).getHours();
        const ampm = time >= 12 ? 'PM' : 'AM';
        const displayTime = (time % 12 || 12) + ampm; // تحويل صيغة 24 لـ 12 ساعة

        const temp = Math.round(hourlyData.temperature_2m[currentHourIndex]) + "°";
        const status = getWeatherCodeName(hourlyData.weather_code[currentHourIndex]);

        // تنظيف المربع وبناؤه
        dvHour.innerHTML = "";
        
        // إضافة الوقت
        const pTime = document.createElement('p');
        pTime.className = "hourly__hour-time";
        pTime.innerText = displayTime;
        
        // إضافة الأيقونة
        const img = document.createElement('img');
        img.className = "hourly__hour-icon";
        img.src = `/assets/images/icon-${status}.webp`;
        img.alt = status;

        // إضافة الحرارة
        const pTemp = document.createElement('p');
        pTemp.className = "hourly__hour-temp";
        pTemp.innerText = temp;

        dvHour.appendChild(pTime);
        dvHour.appendChild(img);
        dvHour.appendChild(pTemp);
    }
}