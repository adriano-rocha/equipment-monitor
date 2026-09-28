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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('TODOS')

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

  const normalizedSearch = search.trim().toLowerCase()

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      normalizedSearch === '' ||
      device.asset_number?.toLowerCase().includes(normalizedSearch) ||
      device.hostname?.toLowerCase().includes(normalizedSearch) ||
      device.reported_ip?.toLowerCase().includes(normalizedSearch)

    const matchesStatus =
      statusFilter === 'TODOS' ||
      device.status === statusFilter

    return matchesSearch && matchesStatus
  })

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
          <div>
            <h2>Equipamentos</h2>
            <span>
              Exibindo {filteredDevices.length} de {devices.length}
            </span>
          </div>
        </div>

        <div className="filters">
          <input
            type="text"
            placeholder="Buscar patrimônio, hostname ou IP..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="status-filters">
            <button
              className={statusFilter === 'TODOS' ? 'active' : ''}
              onClick={() => setStatusFilter('TODOS')}
            >
              Todos
            </button>

            <button
              className={statusFilter === 'ONLINE' ? 'active' : ''}
              onClick={() => setStatusFilter('ONLINE')}
            >
              Online
            </button>

            <button
              className={
                statusFilter === 'SEM COMUNICAÇÃO' ? 'active' : ''
              }
              onClick={() => setStatusFilter('SEM COMUNICAÇÃO')}
            >
              Sem comunicação
            </button>

            <button
              className={statusFilter === 'OFFLINE' ? 'active' : ''}
              onClick={() => setStatusFilter('OFFLINE')}
            >
              Offline
            </button>
          </div>
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
              {filteredDevices.map((device) => (
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

              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Nenhum equipamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App