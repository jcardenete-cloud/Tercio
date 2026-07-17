import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from './supabaseClient';

interface Dia {
  fecha: string;
  tipo: 'laborable' | 'festivo' | 'libre';
  horas: number;
  comentario: string;
}

interface MesData {
  days: Dia[];
  total_jornada_mensual: number;
  max_horas_libres: number;
  dos_tercios_jornada: number;
}

interface ResumenMes {
  mes: string;
  jornada_total: number;
  dos_tercios: number;
  horas_trabajadas: number;
  un_tercio: number;
  horas_libres: number;
}

const App: React.FC = () => {
  const [view, setView] = useState<'calendar' | 'summary'>('calendar');
  const [data, setData] = useState<MesData | null>(null);
  const [resumen, setResumen] = useState<ResumenMes[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [error, setError] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (view === 'calendar') {
      fetchData();
    } else {
      fetchResumen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, view]);

  const fetchData = async () => {
    setError(null);
    try {
      const numDays = new Date(year, month, 0).getDate();
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`;

      const { data: dbDaysList, error: dbError } = await supabase
        .from('dias')
        .select('*')
        .gte('fecha', startOfMonth)
        .lte('fecha', endOfMonth);

      if (dbError) throw dbError;

      const dbDays: { [key: string]: any } = {};
      if (dbDaysList) {
        dbDaysList.forEach((d: any) => {
          dbDays[d.fecha] = d;
        });
      }

      const days: Dia[] = [];
      for (let day = 1; day <= numDays; day++) {
        const current_date = new Date(year, month - 1, day);
        const yyyy = current_date.getFullYear();
        const mm = String(current_date.getMonth() + 1).padStart(2, '0');
        const dd = String(current_date.getDate()).padStart(2, '0');
        const date_str = `${yyyy}-${mm}-${dd}`;
        const is_weekend = current_date.getDay() === 0 || current_date.getDay() === 6;

        let day_data;
        if (date_str in dbDays) {
          day_data = dbDays[date_str];
        } else {
          day_data = {
            fecha: date_str,
            tipo: is_weekend ? 'festivo' : 'laborable',
            horas_reales: is_weekend ? 0 : 7,
            comentario: ''
          };
        }

        days.push({
          fecha: date_str,
          tipo: day_data.tipo,
          horas: Number(day_data.horas_reales),
          comentario: day_data.comentario || ''
        });
      }

      let total_horas = 0;
      days.forEach((d) => {
        const parts = d.fecha.split('-');
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        if (!isWeekend && d.tipo !== 'festivo') {
          total_horas += 7;
        }
      });

      const max_libres_horas = total_horas / 3;
      const dos_tercios_horas = (total_horas * 2) / 3;

      setData({
        days,
        total_jornada_mensual: total_horas,
        max_horas_libres: Number(max_libres_horas.toFixed(2)),
        dos_tercios_jornada: Number(dos_tercios_horas.toFixed(2))
      });
    } catch (err: any) {
      console.error("Error al obtener datos", err);
      setError("Error al conectar con Supabase. Asegúrate de haber creado la tabla 'dias' y configurado el archivo '.env' correctamente. Detalles: " + (err.message || String(err)));
    }
  };

  const fetchResumen = async () => {
    setError(null);
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const { data: dbDaysList, error: dbError } = await supabase
        .from('dias')
        .select('*')
        .gte('fecha', startOfYear)
        .lte('fecha', endOfYear);

      if (dbError) throw dbError;

      const dbDays: { [key: string]: any } = {};
      if (dbDaysList) {
        dbDaysList.forEach((d: any) => {
          dbDays[d.fecha] = d;
        });
      }

      const meses_es = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      const res: ResumenMes[] = [];
      for (let m = 1; m <= 12; m++) {
        const num_days = new Date(year, m, 0).getDate();
        let jornada_total_mes = 0;
        let horas_trabajadas = 0;
        let horas_libres = 0;

        for (let day = 1; day <= num_days; day++) {
          const curr_date = new Date(year, m - 1, day);
          const yyyy = curr_date.getFullYear();
          const mm = String(curr_date.getMonth() + 1).padStart(2, '0');
          const dd = String(curr_date.getDate()).padStart(2, '0');
          const curr_date_str = `${yyyy}-${mm}-${dd}`;
          const is_weekend = curr_date.getDay() === 0 || curr_date.getDay() === 6;

          let tipo;
          if (curr_date_str in dbDays) {
            tipo = dbDays[curr_date_str].tipo;
          } else {
            tipo = is_weekend ? 'festivo' : 'laborable';
          }

          if (!is_weekend && tipo !== 'festivo') {
            jornada_total_mes += 7;
          }

          if (tipo === 'laborable') {
            horas_trabajadas += 7;
          } else if (tipo === 'libre') {
            horas_libres += 7;
          }
        }

        res.push({
          mes: meses_es[m],
          jornada_total: jornada_total_mes,
          dos_tercios: Number(((jornada_total_mes * 2) / 3).toFixed(2)),
          horas_trabajadas: horas_trabajadas,
          un_tercio: Number((jornada_total_mes / 3).toFixed(2)),
          horas_libres: horas_libres
        });
      }

      setResumen(res);
    } catch (err: any) {
      console.error("Error al obtener resumen", err);
      setError("Error al obtener el resumen de Supabase. Detalles: " + (err.message || String(err)));
    }
  };

  const toggleDia = async (dia: Dia) => {
    let nextTipo: Dia['tipo'] = 'laborable';
    if (dia.tipo === 'laborable') nextTipo = 'festivo';
    else if (dia.tipo === 'festivo') nextTipo = 'libre';
    else nextTipo = 'laborable';

    const horas = nextTipo === 'laborable' ? 7 : 0;

    try {
      const { error: dbError } = await supabase
        .from('dias')
        .upsert({
          fecha: dia.fecha,
          tipo: nextTipo,
          horas_reales: horas,
          comentario: dia.comentario || ''
        }, { onConflict: 'fecha' });

      if (dbError) throw dbError;
      fetchData();
    } catch (err: any) {
      console.error("Error al actualizar día", err);
      setError("Error al actualizar el día en Supabase: " + (err.message || String(err)));
    }
  };

  const changeMonth = (offset: number) => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(nextDate);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const exportPDF = async () => {
    if (!calendarRef.current) return;

    // Forzamos modo claro brevemente para el PDF si el usuario prefiere un fondo blanco para imprimir
    const originalTheme = theme;
    if (theme === 'dark') setTheme('light');

    // Esperar un momento a que el tema se aplique para la captura
    setTimeout(async () => {
      const canvas = await html2canvas(calendarRef.current!, {
        scale: 2,
        backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const finalWidth = imgWidth * ratio - 20;
      const finalHeight = imgHeight * ratio - 20;

      pdf.setFontSize(18);
      pdf.text(`Cuadrante Horario - ${mesNombre} ${year}`, 10, 15);
      pdf.addImage(imgData, 'PNG', 10, 25, finalWidth, finalHeight);
      pdf.save(`cuadrante_${mesNombre}_${year}.pdf`);

      // Restauramos el tema anterior
      setTheme(originalTheme);
    }, 100);
  };

  const exportSummaryPDF = async () => {
    if (!summaryRef.current) return;

    const originalTheme = theme;
    if (theme === 'dark') setTheme('light');

    setTimeout(async () => {
      const canvas = await html2canvas(summaryRef.current!, {
        scale: 2,
        backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 40) / imgHeight);

      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      pdf.setFontSize(18);
      pdf.setTextColor(59, 130, 246); // Color #3b82f6 (var --accent)
      pdf.text(`Resumen Anual - Año ${year}`, 10, 15);
      pdf.addImage(imgData, 'PNG', 10, 25, finalWidth, finalHeight);
      pdf.save(`resumen_anual_${year}.pdf`);

      setTheme(originalTheme);
    }, 100);
  };

  const mesNombre = currentDate.toLocaleString('es-ES', { month: 'long' });

  // Calcular acumulado
  let acumuladoDiferencia = 0;
  const resumenConAcumulado = resumen.map(r => {
    const diferenciaMes = r.un_tercio - r.horas_libres;
    acumuladoDiferencia += diferenciaMes;
    return { ...r, acumulado: acumuladoDiferencia };
  });

  return (
    <div className="container">
      <header className="header">
        <h1>Control Horario</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
        </button>

        <div className="tabs">
          <button
            className={`tab-btn ${view === 'calendar' ? 'active' : ''}`}
            onClick={() => setView('calendar')}
          >
            Calendario
          </button>
          <button
            className={`tab-btn ${view === 'summary' ? 'active' : ''}`}
            onClick={() => setView('summary')}
          >
            Resumen Anual
          </button>
        </div>

        {view === 'calendar' ? (
          <div className="controls">
            <button className="nav-btn" onClick={() => changeMonth(-1)}>&larr; Anterior</button>
            <button className="nav-btn" onClick={() => setCurrentDate(new Date())}>Hoy</button>
            <button className="nav-btn" onClick={() => changeMonth(1)}>Siguiente &rarr;</button>
            <button className="nav-btn" style={{ background: 'var(--accent)', color: 'white' }} onClick={exportPDF}>
              📄 Exportar PDF
            </button>
          </div>
        ) : (
          <div className="controls">
            <button className="nav-btn" style={{ background: 'var(--accent)', color: 'white' }} onClick={exportSummaryPDF}>
              📄 Exportar Resumen PDF
            </button>
          </div>
        )}
      </header>

      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5',
          padding: '1rem',
          borderRadius: '0.5rem',
          margin: '1rem auto',
          maxWidth: '600px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '0.9rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {view === 'calendar' ? (
        <div ref={calendarRef} style={{ padding: '10px' }}>
          {data ? (
            <>
              <h2 style={{ textAlign: 'center', textTransform: 'capitalize', color: 'var(--accent)' }}>
                {mesNombre} {year}
              </h2>
              <section className="stats">
                <div className="stat-card">
                  <div className="stat-label">Jornada Total</div>
                  <div className="stat-value">{data.total_jornada_mensual}h</div>
                  <div className="stat-sub">{Math.round(data.total_jornada_mensual / 7)} días</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">2/3 de Jornada</div>
                  <div className="stat-value">{data.dos_tercios_jornada}h</div>
                  <div className="stat-sub">{Math.round(data.dos_tercios_jornada / 7)} días</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Máx. 1/3 Libres</div>
                  <div className="stat-value">{data.max_horas_libres}h</div>
                  <div className="stat-sub">{Math.round(data.max_horas_libres / 7)} días</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Libres Usados</div>
                  <div className="stat-value" style={{ color: (data.days.filter(d => d.tipo === 'libre').length * 7) > data.max_horas_libres ? '#ef4444' : '#3b82f6' }}>
                    {data.days.filter(d => d.tipo === 'libre').length * 7}h
                  </div>
                  <div className="stat-sub">{data.days.filter(d => d.tipo === 'libre').length} días</div>
                </div>
              </section>

              <div className="calendar">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="day-header">{d}</div>
                ))}
                {Array.from({ length: (new Date(year, month - 1, 1).getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {data.days.map(dia => {
                  const diaNum = new Date(dia.fecha).getDate();
                  return (
                    <div
                      key={dia.fecha}
                      className={`day-cell type-${dia.tipo}`}
                      onClick={() => toggleDia(dia)}
                    >
                      <span className="day-number">{diaNum}</span>
                      <span className="day-badge">{dia.tipo}</span>
                      <div className="day-hours" style={{ fontSize: '0.65rem', fontWeight: 'bold', opacity: 0.8 }}>
                        {dia.tipo === 'laborable' ? '7h' : '0h'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>Cargando calendario...</div>
          )}
        </div>
      ) : (
        <section ref={summaryRef}>
          <h2 style={{ textAlign: 'center', color: 'var(--accent)' }}>Resumen Anual {year}</h2>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Jornada Total</th>
                <th>2/3 Jornada</th>
                <th>Horas Trab.</th>
                <th>1/3 Máx.</th>
                <th>Libres Real</th>
                <th>Acumulado (+/-)</th>
              </tr>
            </thead>
            <tbody>
              {resumenConAcumulado.map(r => (
                <tr key={r.mes}>
                  <td style={{ fontWeight: 'bold' }}>{r.mes}</td>
                  <td>{r.jornada_total}h</td>
                  <td>{r.dos_tercios}h</td>
                  <td className="highlight">{r.horas_trabajadas}h</td>
                  <td>{r.un_tercio}h</td>
                  <td style={{ color: r.horas_libres > r.un_tercio ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                    {r.horas_libres}h
                  </td>
                  <td style={{
                    fontWeight: 'bold',
                    color: r.acumulado >= 0 ? '#10b981' : '#ef4444',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)'
                  }}>
                    {r.acumulado.toFixed(2)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            * El acumulado muestra el balance de horas libres sobrantes (+) o excedidas (-) respecto al tercio mensual.
          </p>
        </section>
      )}
    </div>
  );
};

export default App;
