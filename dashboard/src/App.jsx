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

function StatusCard({ title, count, className }) {
  return (
    <div className={`status-card ${className}`}>
      <span className="status-card-title">{title}</span>
      <strong className="status-card-count">{count}</strong>
    </div>
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

  const onlineCount = devices.filter(
    (device) => device.status === 'ONLINE',
  ).length

  const warningCount = devices.filter(
    (device) => device.status === 'SEM COMUNICAÇÃO',
  ).length

  const offlineCount = devices.filter(
    (device) => device.status === 'OFFLINE',
  ).length

  return (
    <main>
      <header className="dashboard-header">
        <div>
          <h1>Equipment Monitor</h1>
          <p>Monitoramento de equipamentos</p>
        </div>

        <div className="device-total">
          <span>Equipamentos monitorados</span>
          <strong>{devices.length}</strong>
        </div>
      </header>

      <section className="status-grid">
        <StatusCard
          title="ONLINE"
          count={onlineCount}
          className="card-online"
        />

        <StatusCard
          title="SEM COMUNICAÇÃO"
          count={warningCount}
          className="card-warning"
        />

        <StatusCard
          title="OFFLINE"
          count={offlineCount}
          className="card-offline"
        />
      </section>

      <section className="devices-section">
        <div className="section-header">
          <h2>Equipamentos</h2>
          <span>{devices.length} equipamento(s)</span>
        </div>

        <div className="table-container">
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
                  <td className="asset-number">
                    {device.asset_number}
                  </td>

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
        </div>
      </section>
    </main>
  )
}

export default App