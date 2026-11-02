import { useCallback, useEffect, useState } from 'react';

type TestAttempt = {
  attemptId: number;
  startedAt: string;
  submittedAt: string;
  score: number;
  totalQuestions: number;
  percentage: number;
};

type Props = {
  token: string;
};

export default function MockTestHistoryPage({ token }: Props) {
  const [history, setHistory] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mock-tests/history', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Could not load test history.');
      }

      setHistory(result.history || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load test history.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <section
      style={{
        marginTop: 32,
        padding: 28,
        border: '1px solid #e1e7ef',
        borderRadius: 16,
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ color: '#718096', fontSize: 12, fontWeight: 700 }}>
            PRACTICE & PREPARATION
          </p>
          <h2 style={{ margin: '6px 0', color: '#1e293b' }}>
            Mock Test Score History
          </h2>
          <p style={{ color: '#718096', margin: 0 }}>
            Review your previous test attempts and scores.
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          style={{
            padding: '10px 18px',
            border: 0,
            borderRadius: 8,
            background: '#1d5147',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {loading && <p>Loading your test history...</p>}

      {error && (
        <p role="alert" style={{ color: '#c0392b' }}>
          {error}
        </p>
      )}

      {!loading && !error && history.length === 0 && (
        <p style={{ color: '#718096', marginTop: 24 }}>
          You haven't completed any mock tests yet. Complete a test to see
          your scores here.
        </p>
      )}

      {!loading && !error && history.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 24 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ background: '#f5f7fa' }}>
                <th style={cellStyle}>Attempt</th>
                <th style={cellStyle}>Date</th>
                <th style={cellStyle}>Score</th>
                <th style={cellStyle}>Percentage</th>
              </tr>
            </thead>

            <tbody>
              {history.map((attempt, index) => (
                <tr key={attempt.attemptId}>
                  <td style={cellStyle}>#{index + 1}</td>
                  <td style={cellStyle}>
                    {new Date(attempt.submittedAt).toLocaleString()}
                  </td>
                  <td style={cellStyle}>
                    {attempt.score} / {attempt.totalQuestions}
                  </td>
                  <td style={cellStyle}>
                    <strong
                      style={{
                        color:
                          attempt.percentage >= 70
                            ? '#16834a'
                            : attempt.percentage >= 40
                              ? '#c27a16'
                              : '#c0392b',
                      }}
                    >
                      {attempt.percentage}%
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #e5eaf0',
  color: '#334155',
  fontSize: 14,
};