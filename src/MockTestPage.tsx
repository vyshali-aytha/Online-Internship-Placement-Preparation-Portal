
import { useCallback, useEffect, useRef, useState } from 'react';

type MockOption = {
  id: string;
  text: string;
};

type MockQuestion = {
  id: string;
  question: string;
  options: MockOption[];
};

type ApiResult = {
  attemptId?: number;
  durationSeconds?: number;
  remainingSeconds?: number;
  questions?: MockQuestion[];
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  expired?: boolean;
  message?: string;
};

type TestResult = {
  score: number;
  totalQuestions: number;
  percentage: number;
  expired: boolean;
  message: string;
};

type MockTestPageProps = {
  token: string;
};

async function readResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();
  let data: ApiResult = {};

  if (text) {
    try {
      data = JSON.parse(text) as ApiResult;
    } catch {
      throw new Error('The server returned an invalid response.');
    }
  }

  if (!response.ok && response.status !== 410) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }

  return data;
}

export default function MockTestPage({ token }: MockTestPageProps) {
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(900);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');

  const submitLock = useRef(false);

  const submitTest = useCallback(async () => {
    if (attemptId === null || submitLock.current || result !== null) {
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(
        `/api/mock-tests/attempts/${attemptId}/submit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answers }),
        },
      );

      const data = await readResponse(response);

      setResult({
        score: data.score ?? 0,
        totalQuestions: data.totalQuestions ?? questions.length,
        percentage: data.percentage ?? 0,
        expired: response.status === 410 || Boolean(data.expired),
        message:
          data.message ||
          (response.status === 410
            ? 'Time is up. Your test has been submitted.'
            : 'Your test has been submitted successfully.'),
      });
    } catch (submitError) {
      submitLock.current = false;
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not submit your test.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, answers, questions.length, result, token]);

  useEffect(() => {
    if (!started || result !== null || submitting) {
      return;
    }

    if (remainingSeconds <= 0) {
      void submitTest();
      return;
    }

    const timer = window.setTimeout(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [started, remainingSeconds, result, submitting, submitTest]);

  async function startTest() {
    setLoading(true);
    setError('');
    setResult(null);
    setQuestions([]);
    setAnswers({});
    setAttemptId(null);
    setRemainingSeconds(900);
    setStarted(false);
    submitLock.current = false;

    try {
      const response = await fetch('/api/mock-tests/attempts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await readResponse(response);

      if (!data.attemptId || !data.questions || data.questions.length === 0) {
        throw new Error('The server did not return a valid test.');
      }

      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setRemainingSeconds(
        data.remainingSeconds ?? data.durationSeconds ?? 900,
      );
      setStarted(true);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : 'Could not start the mock test.',
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(questionId: string, optionId: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  }

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <section className="mock-test-page">
      <style>{`
        .mock-test-page {
          margin: 28px 0;
          padding: 28px;
          border: 1px solid #e3e8ef;
          border-radius: 18px;
          background: #ffffff;
          color: #172338;
        }

        .mock-test-page * {
          box-sizing: border-box;
        }

        .mock-test-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .mock-test-eyebrow {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .mock-test-heading h2 {
          margin: 7px 0;
          font-size: 25px;
          color: #172338;
        }

        .mock-test-description {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
          font-size: 14px;
        }

        .mock-test-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 20px 0;
        }

        .mock-test-meta span {
          padding: 8px 12px;
          background: #f1f5f9;
          border-radius: 8px;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
        }

        .mock-test-button {
          border: 0;
          border-radius: 9px;
          background: #e76b32;
          color: white;
          padding: 13px 20px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .mock-test-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mock-test-timer {
          padding: 10px 15px;
          border-radius: 10px;
          background: #fff4ed;
          color: #c45120;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          font-size: 18px;
        }

        .mock-test-timer.warning {
          background: #fee2e2;
          color: #b91c1c;
        }

        .mock-test-progress {
          height: 7px;
          margin: 18px 0 24px;
          overflow: hidden;
          background: #e8edf3;
          border-radius: 10px;
        }

        .mock-test-progress > div {
          height: 100%;
          background: #e76b32;
          transition: width 0.2s ease;
        }

        .mock-question {
          padding: 19px 0;
          border-top: 1px solid #edf0f4;
        }

        .mock-question-title {
          margin: 0 0 14px;
          font-size: 15px;
          line-height: 1.6;
          font-weight: 700;
        }

        .mock-question-number {
          color: #e76b32;
          margin-right: 7px;
        }

        .mock-option {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 9px 0;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.5;
        }

        .mock-option.selected {
          border-color: #e76b32;
          background: #fff7f2;
        }

        .mock-option input {
          margin-top: 3px;
          accent-color: #e76b32;
        }

        .mock-test-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #edf0f4;
        }

        .mock-test-muted {
          color: #64748b;
          font-size: 13px;
        }

        .mock-test-error {
          margin: 14px 0;
          padding: 12px;
          border-radius: 8px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
        }

        .mock-test-result {
          margin-top: 20px;
          padding: 22px;
          border-radius: 13px;
          background: #f8fafc;
          text-align: center;
        }

        .mock-test-score {
          margin: 12px 0;
          color: #e76b32;
          font-size: 42px;
          font-weight: 800;
        }

        @media (max-width: 600px) {
          .mock-test-page {
            padding: 18px;
          }

          .mock-test-heading h2 {
            font-size: 21px;
          }
        }
      `}</style>

      <div className="mock-test-heading">
        <div>
          <span className="mock-test-eyebrow">
            PRACTICE &amp; PREPARATION
          </span>
          <h2>Timed Mock Test</h2>
          <p className="mock-test-description">
            Test your knowledge, practise under time pressure, and review your score.
          </p>
        </div>

        {started && !result && (
          <div
            className={`mock-test-timer ${
              remainingSeconds <= 60 ? 'warning' : ''
            }`}
          >
            {formatTime(remainingSeconds)}
          </div>
        )}
      </div>

      {!started && !result && (
        <>
          <div className="mock-test-meta">
            <span>10 Questions</span>
            <span>15 Minutes</span>
            <span>Automatic Scoring</span>
          </div>

          <p className="mock-test-description">
            Once you start, the timer begins immediately. Your answers will be
            submitted automatically when the time runs out.
          </p>

          {error && (
            <p className="mock-test-error" role="alert">
              {error}
            </p>
          )}

          <div style={{ marginTop: 22 }}>
            <button
              type="button"
              className="mock-test-button"
              onClick={startTest}
              disabled={loading}
            >
              {loading ? 'Starting test…' : 'Start Mock Test →'}
            </button>
          </div>
        </>
      )}

      {started && !result && (
        <>
          <div className="mock-test-footer">
            <span className="mock-test-muted">
              Answered {answeredCount} of {questions.length}
            </span>
            <span className="mock-test-muted">
              {questions.length - answeredCount} remaining
            </span>
          </div>

          <div
            className="mock-test-progress"
            aria-label={`${answeredCount} of ${questions.length} questions answered`}
          >
            <div
              style={{
                width: `${
                  questions.length
                    ? (answeredCount / questions.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {questions.map((question, index) => (
            <article className="mock-question" key={question.id}>
              <h3 className="mock-question-title">
                <span className="mock-question-number">
                  Q{index + 1}.
                </span>
                {question.question}
              </h3>

              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;

                return (
                  <label
                    className={`mock-option ${
                      selected ? 'selected' : ''
                    }`}
                    key={option.id}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={selected}
                      onChange={() =>
                        chooseAnswer(question.id, option.id)
                      }
                    />
                    <span>{option.text}</span>
                  </label>
                );
              })}
            </article>
          ))}

          {error && (
            <p className="mock-test-error" role="alert">
              {error}
            </p>
          )}

          <div className="mock-test-footer">
            <span className="mock-test-muted">
              Your answers are scored automatically.
            </span>

            <button
              type="button"
              className="mock-test-button"
              onClick={() => {
                if (
                  window.confirm(
                    'Are you sure you want to submit your test?',
                  )
                ) {
                  void submitTest();
                }
              }}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Test'}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="mock-test-result" role="status">
          <span className="mock-test-eyebrow">
            {result.expired ? 'TIME EXPIRED' : 'TEST COMPLETED'}
          </span>

          <h3>
            {result.expired ? 'Your time is up.' : 'Well done!'}
          </h3>

          <div className="mock-test-score">
            {result.score} / {result.totalQuestions}
          </div>

          <p className="mock-test-description">
            You scored {result.percentage}%.
          </p>

          <p className="mock-test-muted">
            {result.message}
          </p>

          <button
            type="button"
            className="mock-test-button"
            style={{ marginTop: 16 }}
            onClick={startTest}
            disabled={loading}
          >
            {loading ? 'Starting…' : 'Try Another Test'}
          </button>
        </div>
      )}
    </section>
  );
}
