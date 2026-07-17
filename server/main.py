from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mysql.connector
from datetime import date, datetime, timedelta
import calendar
from typing import List, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="aamariadb",
        database="control_horario"
    )

class DiaUpdate(BaseModel):
    fecha: str
    tipo: str
    comentario: Optional[str] = None

@app.get("/mes/{year}/{month}")
def get_mes(year: int, month: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM dias WHERE YEAR(fecha) = %s AND MONTH(fecha) = %s", (year, month))
    db_days = {d['fecha'].strftime('%Y-%m-%d'): d for d in cursor.fetchall()}
    
    num_days = calendar.monthrange(year, month)[1]
    days = []
    
    # Primero generamos la lista de días y cruzamos con DB
    for day in range(1, num_days + 1):
        current_date = date(year, month, day)
        date_str = current_date.strftime('%Y-%m-%d')
        is_weekend = current_date.weekday() >= 5
        
        if date_str in db_days:
            day_data = db_days[date_str]
        else:
            day_data = {
                'fecha': current_date,
                'tipo': 'festivo' if is_weekend else 'laborable',
                'horas_reales': 0 if is_weekend else 7,
                'comentario': ''
            }
        
        days.append({
            'fecha': date_str,
            'tipo': day_data['tipo'],
            'horas': day_data['horas_reales'],
            'comentario': day_data['comentario']
        })

    # Cálculo de jornada mensual considerando días festivos marcados
    total_horas = 0
    for d in days:
        # Se suma a la jornada total solo si es un día de semana (L-V) 
        # Y NO ha sido marcado explícitamente como festivo
        if datetime.strptime(d['fecha'], '%Y-%m-%d').weekday() < 5:
            if d['tipo'] != 'festivo':
                total_horas += 7
            
    max_libres_horas = total_horas / 3
    dos_tercios_horas = (total_horas * 2) / 3
    
    cursor.close()
    conn.close()
    
    return {
        "days": days,
        "total_jornada_mensual": total_horas,
        "max_horas_libres": round(max_libres_horas, 2),
        "dos_tercios_jornada": round(dos_tercios_horas, 2)
    }

@app.post("/dia")
def update_dia(data: DiaUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    horas = 7 if data.tipo == 'laborable' else 0
    
    query = """
    INSERT INTO dias (fecha, tipo, horas_reales, comentario)
    VALUES (%s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE tipo=%s, horas_reales=%s, comentario=%s
    """
    cursor.execute(query, (data.fecha, data.tipo, horas, data.comentario, data.tipo, horas, data.comentario))
    
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "ok"}

@app.get("/resumen/{year}")
def get_resumen_anual(year: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM dias WHERE YEAR(fecha) = %s", (year,))
    db_days_list = cursor.fetchall()
    db_days = {d['fecha'].strftime('%Y-%m-%d'): d for d in db_days_list}
    
    meses_es = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    
    resumen = []
    for m in range(1, 13):
        num_days = calendar.monthrange(year, m)[1]
        jornada_total_mes = 0
        horas_trabajadas = 0
        horas_libres = 0
        
        for day in range(1, num_days + 1):
            curr_date = date(year, m, day)
            curr_date_str = curr_date.strftime('%Y-%m-%d')
            is_weekend = curr_date.weekday() >= 5
            
            # Obtener estado actual (de DB o por defecto)
            if curr_date_str in db_days:
                tipo = db_days[curr_date_str]['tipo']
            else:
                tipo = 'festivo' if is_weekend else 'laborable'
            
            # Cálculo de Jornada Total Mensual: L-V que NO son festivos
            if not is_weekend and tipo != 'festivo':
                jornada_total_mes += 7
            
            # Cálculo de horas trabajadas reales y libres
            if tipo == 'laborable':
                horas_trabajadas += 7
            elif tipo == 'libre':
                horas_libres += 7

        resumen.append({
            "mes": meses_es[m],
            "jornada_total": jornada_total_mes,
            "dos_tercios": round((jornada_total_mes * 2) / 3, 2),
            "horas_trabajadas": horas_trabajadas,
            "un_tercio": round(jornada_total_mes / 3, 2),
            "horas_libres": horas_libres
        })
        
    cursor.close()
    conn.close()
    return resumen

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
