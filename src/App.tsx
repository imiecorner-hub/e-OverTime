import React, { useState, useEffect } from 'react';
import Holidays from 'date-holidays';
import { 
  Calendar, Monitor, Clock, User, ChevronLeft, ChevronRight, 
  Filter, Download, FileText, Edit, Calculator, Trash2
} from 'lucide-react';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [gaji, setGaji] = useState<number>(2844.19);
  
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // Start at March 2026
  
  const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const monthNames = [
    'JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 
    'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'
  ];

  const hd = new Holidays('MY'); // Initialize for Malaysia

  const generateMonthRecords = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const records = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayName = days[date.getDay()];
      const isWeekend = date.getDay() === 5 || date.getDay() === 6; // Jumaat & Sabtu
      
      // Check for public holidays
      const holidays = hd.isHoliday(date);
      const isPublicHoliday = holidays && holidays.length > 0;
      const holidayName = isPublicHoliday ? holidays[0].name : '';
      
      records.push({
        id: `${year}-${month}-${i}`, // Unique ID across months
        date: `${i.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`,
        day: dayName,
        isWeekend,
        isPublicHoliday,
        inTime: '',
        outTime: '',
        inTime2: '',
        outTime2: '',
        note: holidayName,
        status: isPublicHoliday ? 'CUTI UMUM' : (isWeekend ? 'REHAT' : 'TIADA REKOD')
      });
    }
    return records;
  };

  // Store records for all months accessed
  const [allRecords, setAllRecords] = useState<Record<string, any[]>>({});

  // Initialize current month if not exists
  useEffect(() => {
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    if (!allRecords[monthKey]) {
      setAllRecords(prev => ({
        ...prev,
        [monthKey]: generateMonthRecords(currentDate.getFullYear(), currentDate.getMonth())
      }));
    }
  }, [currentDate]);

  // Get records for current month
  const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
  const records = allRecords[currentMonthKey] || [];

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    const period = date.getHours() >= 12 ? 'PTG' : 'PG';
    
    return `${hours}:${minutes}:${seconds} ${period}`;
  };

  const parseTimeStr = (timeStr: string) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + minutes / 60;
  };

  const handleRecordChange = (id: string, field: string, value: any) => {
    setAllRecords(prev => {
      const newRecords = { ...prev };
      newRecords[currentMonthKey] = newRecords[currentMonthKey].map(r => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          // Update status based on whether at least one complete pair is filled
          const hasPair1 = updated.inTime && updated.outTime;
          const hasPair2 = updated.inTime2 && updated.outTime2;
          const hasAnyInput = updated.inTime || updated.outTime || updated.inTime2 || updated.outTime2;
          
          if (hasPair1 || hasPair2) {
            updated.status = 'LENGKAP';
          } else if (!hasAnyInput) {
            updated.status = (r.isWeekend) ? 'REHAT' : 'TIADA REKOD';
          } else {
            updated.status = 'TIDAK LENGKAP';
          }
          return updated;
        }
        return r;
      });
      return newRecords;
    });
  };

  const clearAllData = () => {
    setAllRecords(prev => {
      const newRecords = { ...prev };
      newRecords[currentMonthKey] = newRecords[currentMonthKey].map(r => ({
        ...r,
        inTime: '',
        outTime: '',
        inTime2: '',
        outTime2: '',
        isPublicHoliday: false,
        status: (r.isWeekend) ? 'REHAT' : 'TIADA REKOD'
      }));
      return newRecords;
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const currentMonthName = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  let totalHours = 0;
  let totalOTHours = 0;
  let totalOTPay = 0;

  const hourlyRate = (gaji * 12) / (313 * 8);

  const calculateRecordOT = (record: any) => {
    if (!record) return { totalDuration: 0, otHours: 0, otPay: 0, siangOT: 0, malamOT: 0 };
    
    let siangOT = 0;
    let malamOT = 0;
    let normalAccumulated = 0;

    const processShift = (inTime: string, outTime: string) => {
      if (!inTime || !outTime) return;
      const inHrs = parseTimeStr(inTime);
      let outHrs = parseTimeStr(outTime);
      if (outHrs < inHrs) outHrs += 24;

      const durationMinutes = Math.round((outHrs - inHrs) * 60);
      
      for (let i = 0; i < durationMinutes; i++) {
        const currentMin = Math.floor(inHrs * 60 + i) % (24 * 60);
        const currentHour = currentMin / 60;
        
        const isSiang = currentHour >= 6 && currentHour < 22; // Siang: 6:00 AM - 10:00 PM

        let isBreakTime = false;
        const dayUpper = record.day.toUpperCase();
        
        if (dayUpper === 'JUMAAT') {
          if ((currentMin >= 780 && currentMin < 870) || (currentMin >= 1170 && currentMin < 1200)) {
            isBreakTime = true;
          }
        } else if (dayUpper === 'SABTU') {
          if ((currentMin >= 780 && currentMin < 810) || (currentMin >= 1170 && currentMin < 1200)) {
            isBreakTime = true;
          }
        } else {
          // Hari Biasa (Ahad - Khamis)
          if (currentMin >= 1170 && currentMin < 1200) {
            isBreakTime = true;
          }
        }

        if (record.isPublicHoliday || record.isWeekend) {
          // Hari Rehat & Cuti Umum: Semua jam dikira OT
          if (!isBreakTime) {
            if (isSiang) siangOT += 1/60; else malamOT += 1/60;
          }
        } else {
          // Hari Biasa: OT bermula 5 petang (17:00) hingga 8 pagi (08:00)
          if (currentHour >= 17 || currentHour < 8) {
            if (!isBreakTime) {
              if (isSiang) siangOT += 1/60; else malamOT += 1/60;
            }
          } else {
            normalAccumulated += 1/60;
          }
        }
      }
    };

    processShift(record.inTime, record.outTime);
    processShift(record.inTime2, record.outTime2);

    const totalDuration = normalAccumulated / 60 + siangOT + malamOT;
    const otHours = siangOT + malamOT;
    
    // Kadar Gandaan berdasarkan gambar
    let multiplierSiang = 1.125; // Hari Biasa Siang: 1 1/8
    let multiplierMalam = 1.25;  // Hari Biasa Malam: 1 1/4
    
    if (record.isPublicHoliday) {
      multiplierSiang = 1.75; // Cuti Umum Siang: 1 3/4
      multiplierMalam = 2.0;  // Cuti Umum Malam: 2
    } else if (record.isWeekend) {
      multiplierSiang = 1.25; // Hari Rehat Siang: 1 1/4
      multiplierMalam = 1.5;  // Hari Rehat Malam: 1 1/2
    }

    const otPay = (siangOT * multiplierSiang + malamOT * multiplierMalam) * hourlyRate;

    return { totalDuration, otHours, otPay, siangOT, malamOT };
  };

  const processedRecords = records.map(record => {
    const otDetails = calculateRecordOT(record);

    totalHours += otDetails.totalDuration;
    totalOTHours += otDetails.otHours;
    totalOTPay += otDetails.otPay;
    
    const hrs = Math.floor(otDetails.totalDuration);
    const mins = Math.round((otDetails.totalDuration - hrs) * 60);
    
    return {
      ...record,
      durationHrs: otDetails.totalDuration,
      durationText: otDetails.totalDuration > 0 ? `${hrs}j ${mins}m` : '-',
      otHours: otDetails.otHours,
      otPay: otDetails.otPay,
      siangOT: otDetails.siangOT,
      malamOT: otDetails.malamOT
    };
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  };

  const todayMonthKey = `${time.getFullYear()}-${time.getMonth()}`;
  const todayId = `${time.getFullYear()}-${time.getMonth()}-${time.getDate()}`;
  const todayRecord = allRecords[todayMonthKey]?.find(r => r.id === todayId);
  const todayOT = calculateRecordOT(todayRecord);

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900 font-sans p-4 md:p-6 flex justify-center">
      <div className="w-full max-w-md space-y-4 pb-10">
        
        {/* Top Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="bg-purple-600 p-2.5 rounded-xl text-white shadow-sm shadow-purple-200">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-800">e-OverTime</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Sistem Kehadiran</p>
            </div>
          </div>
          <button className="bg-white p-4 rounded-2xl shadow-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Monitor className="w-5 h-5" />
          </button>
        </div>

        {/* Live Clock */}
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm relative">
          <div className="flex justify-between items-center mb-2">
            <p className="text-purple-600 text-xs font-bold tracking-widest uppercase">
              {days[time.getDay()]}, {time.getDate()} {monthNames[time.getMonth()]}
            </p>
            {todayOT.otPay > 0 && (
              <div className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">
                OT HARI INI: {formatCurrency(todayOT.otPay)}
              </div>
            )}
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-800 font-mono">
            {formatTime(time)}
          </h2>
          {todayOT.otHours > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center gap-4 text-xs font-medium text-slate-500">
              {todayOT.siangOT > 0 && <span>Siang: {todayOT.siangOT.toFixed(1)}j</span>}
              {todayOT.malamOT > 0 && <span>Malam: {todayOT.malamOT.toFixed(1)}j</span>}
              <span className="text-purple-600 font-bold">Jumlah OT: {todayOT.otHours.toFixed(1)}j</span>
            </div>
          )}
        </div>

        {/* Salary Input & Rates */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 w-[52px] h-[52px] rounded-2xl text-white shadow-md shadow-emerald-200 flex items-center justify-center shrink-0">
              <span className="font-bold text-lg">RM</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-0.5">
                Gaji Pokok (RM)
              </p>
              <input
                type="number"
                value={gaji || ''}
                onChange={(e) => setGaji(parseFloat(e.target.value))}
                className="w-full text-2xl font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 outline-none"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>
          
          {/* Overtime Rates Display */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-[9px] text-slate-400 font-bold uppercase mb-1.5">Hari Biasa</p>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-bold text-slate-700 leading-none">RM{(hourlyRate * 1.125).toFixed(2)} <span className="font-normal text-slate-500 text-[9px]">Siang</span></p>
                <p className="text-[10px] font-bold text-slate-700 leading-none">RM{(hourlyRate * 1.25).toFixed(2)} <span className="font-normal text-slate-500 text-[9px]">Malam</span></p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-[9px] text-amber-600/70 font-bold uppercase mb-1.5">Hari Rehat</p>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-bold text-amber-700 leading-none">RM{(hourlyRate * 1.25).toFixed(2)} <span className="font-normal text-amber-600/70 text-[9px]">Siang</span></p>
                <p className="text-[10px] font-bold text-amber-700 leading-none">RM{(hourlyRate * 1.5).toFixed(2)} <span className="font-normal text-amber-600/70 text-[9px]">Malam</span></p>
              </div>
            </div>
            <div className="bg-rose-50 rounded-lg p-2">
              <p className="text-[9px] text-rose-500/70 font-bold uppercase mb-1.5">Cuti Umum</p>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-bold text-rose-600 leading-none">RM{(hourlyRate * 1.75).toFixed(2)} <span className="font-normal text-rose-500/70 text-[9px]">Siang</span></p>
                <p className="text-[10px] font-bold text-rose-600 leading-none">RM{(hourlyRate * 2.0).toFixed(2)} <span className="font-normal text-rose-500/70 text-[9px]">Malam</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Total Hours */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">
                Jum. Jam
              </p>
            </div>
            <p className="text-sm font-bold text-slate-800">
              {Math.floor(totalHours)}j {Math.round((totalHours - Math.floor(totalHours)) * 60)}m
            </p>
          </div>

          {/* OT Hours */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">
                Jam OT
              </p>
            </div>
            <p className="text-sm font-bold text-purple-600">
              {Math.floor(totalOTHours)}j {Math.round((totalOTHours - Math.floor(totalOTHours)) * 60)}m
            </p>
          </div>

          {/* OT Pay */}
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600">
                <Calculator className="w-3.5 h-3.5" />
              </div>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">
                Bayaran OT
              </p>
            </div>
            <p className="text-sm font-bold text-emerald-600">
              {formatCurrency(totalOTPay)}
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-5">
          
          {/* Worker Name */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
            <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-0.5">
                Nama Pekerja
              </p>
              <p className="font-bold text-slate-800 text-sm">
                Imie
              </p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200">
            <button 
              onClick={handlePrevMonth}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm tracking-wide text-slate-800">{currentMonthName}</span>
            <button 
              onClick={handleNextMonth}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Filter & Actions */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-slate-500 text-xs font-medium">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>Laporan: Semua Tarikh</span>
            </div>
            <button 
              onClick={clearAllData}
              className="flex items-center gap-1.5 text-red-500 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Padam Semua</span>
            </button>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
              <FileText className="w-4 h-4" /> TXT
            </button>
          </div>

          {/* Records List */}
          <div className="space-y-4 pt-2">
            {processedRecords.map((record) => (
              <div key={record.id} className={`border rounded-2xl p-4 space-y-4 transition-colors ${
                record.isPublicHoliday
                  ? 'border-rose-200 bg-rose-50/80'
                  : record.isWeekend 
                    ? 'border-amber-200 bg-amber-50/80' 
                    : 'border-slate-200 bg-white'
              }`}>
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-sm ${
                    record.isPublicHoliday ? 'text-rose-900' : record.isWeekend ? 'text-amber-900' : 'text-slate-800'
                  }`}>
                    {record.date}
                  </span>
                  <span className={`text-sm font-medium px-2.5 py-1 rounded-md ${
                    record.isPublicHoliday ? 'bg-rose-100 text-rose-800' : record.isWeekend ? 'bg-amber-100 text-amber-800' : 'text-slate-500'
                  }`}>
                    {record.day}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {/* First Shift */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1.5">Masuk 1</p>
                      <input
                        type="time"
                        value={record.inTime}
                        onChange={(e) => handleRecordChange(record.id, 'inTime', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl py-2 px-2 text-center text-sm font-medium text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1.5">Keluar 1</p>
                      <input
                        type="time"
                        value={record.outTime}
                        onChange={(e) => handleRecordChange(record.id, 'outTime', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl py-2 px-2 text-center text-sm font-medium text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Second Shift */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1.5">Masuk 2</p>
                      <input
                        type="time"
                        value={record.inTime2}
                        onChange={(e) => handleRecordChange(record.id, 'inTime2', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl py-2 px-2 text-center text-sm font-medium text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1.5">Keluar 2</p>
                      <input
                        type="time"
                        value={record.outTime2}
                        onChange={(e) => handleRecordChange(record.id, 'outTime2', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl py-2 px-2 text-center text-sm font-medium text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Duration & OT Summary */}
                  <div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-xl border border-slate-100 mt-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-0.5">Tempoh</p>
                      <p className="font-bold text-sm text-slate-800">{record.durationText}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-purple-500 font-bold tracking-wider uppercase mb-0.5">
                        OT ({record.otHours.toFixed(1)}j)
                      </p>
                      <div className="flex flex-col items-end">
                        <p className="font-bold text-sm text-purple-600">{formatCurrency(record.otPay)}</p>
                        {record.otHours > 0 && (
                          <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                            {record.siangOT > 0 ? `S:${record.siangOT.toFixed(1)}j ` : ''}
                            {record.malamOT > 0 ? `M:${record.malamOT.toFixed(1)}j` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Catatan ringkas (pilihan)..."
                      value={record.note || ''}
                      onChange={(e) => handleRecordChange(record.id, 'note', e.target.value)}
                      className="w-full border border-slate-200 rounded-xl py-2 px-3 text-sm text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end items-center pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRecordChange(record.id, 'isPublicHoliday', !record.isPublicHoliday)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wider uppercase transition-colors ${
                        record.isPublicHoliday
                          ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Cuti Umum
                    </button>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wider uppercase ${
                      record.status === 'LENGKAP' ? 'bg-emerald-100/80 text-emerald-700' : 
                      record.status === 'REHAT' ? 'bg-slate-200 text-slate-500' :
                      record.status === 'TIDAK LENGKAP' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {record.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
