import { useEffect, useState } from 'react'
import { getDevices } from './services/api'

function StatusBadge({ status }) {
  const statusConfig = {
    ONLINE: {
      label: 'ONLINE',
      className: 'status-online',
    },
    'SEM COMUNICAÇÃO': {
      label: 'SEM COMUNICAÇÃO',
      className: 'status-warning',
    },
    OFFLINE: {
      label: 'OFFLINE',
      className: 'status-offline',
    },
  }

  const config = statusConfig[status] ?? {
    label: status ?? 'SEM REGISTRO',
    className: 'status-unknown',
  }

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  )
}

function App() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function fetchDevices() {
      try {
        const data = await getDevices()

        if (active) {
          setDevices(data)
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('Erro ao carregar equipamentos:', err)

        if (active) {
          setError('Não foi possível carregar os equipamentos.')
          setLoading(false)
        }
      }
    }

    fetchDevices()

    const intervalId = setInterval(fetchDevices, 30_000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [])

  if (loading) {
    return <p>Carregando equipamentos...</p>
  }

  if (error) {
    return <p>{error}</p>
  }

  return (
    <main>
      <h1>Equipment Monitor</h1>

      <p>Equipamentos monitorados: {devices.length}</p>

      <table>
        <thead>
          <tr>
            <th>Patrimônio</th>
            <th>Hostname</th>
            <th>IP</th>
            <th>Bateria</th>
            <th>Status</th>
            <th>Último contato</th>
          </tr>
        </thead>

        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.asset_number}</td>
              <td>{device.hostname ?? '-'}</td>
              <td>{device.reported_ip ?? '-'}</td>
              <td>
                {device.battery_level !== null
                  ? `${device.battery_level}%`
                  : '-'}
              </td>
              <td>
                <StatusBadge status={device.status} />
              </td>
              <td>{device.last_seen ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

export default App