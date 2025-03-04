import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useSchedulerContext } from '../context/SchedulerContext';
import { Sun } from 'lucide-react';
import CalendarToolbar from './CalendarToolbar';
import { eventStyleGetter } from '../utils/eventStyles';
import '../styles/MainCalendar.css';

const locales = {
  'en-US': require('date-fns/locale/en-US')
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const MainCalendar = () => {
  const [weekWeather, setWeekWeather] = useState([]);
  const {
    events,
    selectedEvent,
    setSelectedEvent,
    setShowEventDialog,
    view,
    setView,
    date,
    setDate,
  } = useSchedulerContext();

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const CHICAGO_LAT = 41.8781;
        const CHICAGO_LON = -87.6298;
        const API_KEY = 'YOUR_OPENWEATHER_API_KEY';
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${CHICAGO_LAT}&lon=${CHICAGO_LON}&units=imperial&appid=${API_KEY}`
        );
        const data = await response.json();
        
        const dailyForecasts = data.list.filter(item => 
          item.dt_txt.includes('12:00:00')
        ).slice(0, 7);

        const weatherData = dailyForecasts.map(forecast => ({
          day: format(new Date(forecast.dt * 1000), 'EEE'),
          temp: Math.round(forecast.main.temp),
          date: format(new Date(forecast.dt * 1000), 'yyyy-MM-dd'),
          weatherIcon: forecast.weather[0].icon
        }));

        setWeekWeather(weatherData);
      } catch (error) {
        console.error('Weather fetch error:', error);
        mockWeatherData();
      }
    };

    const mockWeatherData = () => {
      const today = new Date();
      const week = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        return {
          day: format(date, 'EEE'),
          temp: Math.floor(Math.random() * (85 - 65) + 65),
          date: format(date, 'yyyy-MM-dd'),
          weatherIcon: '01d'
        };
      });
      setWeekWeather(week);
    };

    fetchWeatherData();
  }, []);

  const { components } = useMemo(() => ({
    components: {
      toolbar: CalendarToolbar,
    }
  }), []);

  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent({
      start,
      end,
      title: '',
      description: '',
      location: '',
      attendees: [],
    });
    setShowEventDialog(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  return (
    <div className="main-calendar-wrapper">
      <div className="weather-strip">
        {weekWeather.map((day) => (
          <div key={day.date} className="weather-day">
            <span className="day-name">{day.day}</span>
            <Sun size={16} />
            <span className="temperature">{day.temp}°</span>
          </div>
        ))}
      </div>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        selectable
        resizable
        defaultView="month"
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        components={components}
        dayLayoutAlgorithm="no-overlap"
        className="main-calendar"
      />
    </div>
  );
};

export default MainCalendar;