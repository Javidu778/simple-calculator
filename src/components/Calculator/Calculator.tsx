import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { evaluateExpression, formatResult, CalculatorError } from './evaluateExpression.ts';
import './Calculator.css';

interface HistoryEntry {
  expression: string;
  result: string;
}

const OPERATORS = ['+', '−', '×', '÷'] as const;
type Operator = (typeof OPERATORS)[number];

function isOperator(ch: string | undefined): ch is Operator {
  return !!ch && (OPERATORS as readonly string[]).includes(ch);
}

/** Returns the run of digits/decimal point at the end of the expression. */
function trailingNumber(expr: string): string {
  const match = expr.match(/[0-9.]*$/);
  return match ? match[0] : '';
}

export default function Calculator(): ReactElement {
  const [expr, setExpr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const lastChar = expr.slice(-1);

  const inputDigit = useCallback(
    (digit: string) => {
      if (error) {
        setError(null);
        setExpr(digit);
        setJustEvaluated(false);
        return;
      }
      if (justEvaluated) {
        setExpr(digit);
        setJustEvaluated(false);
        return;
      }
      // Prevent leading zeros like "007" -> "07"
      if (digit === '0' && trailingNumber(expr) === '0') return;
      setExpr((prev) => prev + digit);
    },
    [error, justEvaluated, expr]
  );

  const inputDecimal = useCallback(() => {
    if (error) {
      setError(null);
      setExpr('0.');
      setJustEvaluated(false);
      return;
    }
    if (justEvaluated) {
      setExpr('0.');
      setJustEvaluated(false);
      return;
    }
    const seg = trailingNumber(expr);
    if (seg.includes('.')) return; // already has a decimal point
    setExpr((prev) => (seg === '' ? prev + '0.' : prev + '.'));
  }, [error, justEvaluated, expr]);

  const inputOperator = useCallback(
    (op: Operator) => {
      if (error) return; // require Clear before continuing after an error
      if (justEvaluated) {
        setExpr((prev) => prev + op);
        setJustEvaluated(false);
        return;
      }
      if (expr === '') {
        if (op === '−') setExpr(op); // allow a leading negative sign
        return;
      }
      if (lastChar === '(') {
        if (op === '−') setExpr((prev) => prev + op); // negative number inside brackets
        return;
      }
      if (isOperator(lastChar)) {
        // Allow "×−5" (operator followed by a negative number) but otherwise
        // replace a trailing operator instead of stacking two.
        if (op === '−' && lastChar !== '−') {
          setExpr((prev) => prev + op);
        } else {
          setExpr((prev) => prev.slice(0, -1) + op);
        }
        return;
      }
      setExpr((prev) => prev + op);
    },
    [error, justEvaluated, expr, lastChar]
  );

  const inputOpenParen = useCallback(() => {
    if (error) {
      setError(null);
      setExpr('(');
      setJustEvaluated(false);
      return;
    }
    if (justEvaluated) {
      setExpr('(');
      setJustEvaluated(false);
      return;
    }
    if (lastChar && /[0-9)]/.test(lastChar)) {
      setExpr((prev) => prev + '×('); // implicit multiplication: 5( -> 5×(
      return;
    }
    setExpr((prev) => prev + '(');
  }, [error, justEvaluated, lastChar]);

  const inputCloseParen = useCallback(() => {
    if (error || justEvaluated) return;
    const openCount = (expr.match(/\(/g) || []).length;
    const closeCount = (expr.match(/\)/g) || []).length;
    if (openCount <= closeCount) return;
    if (!lastChar || isOperator(lastChar) || lastChar === '(') return;
    setExpr((prev) => prev + ')');
  }, [error, justEvaluated, expr, lastChar]);

  const inputPercent = useCallback(() => {
    if (error || !expr) return;
    const seg = trailingNumber(expr);
    if (!seg) return;
    const value = parseFloat(seg) / 100;
    const prefix = expr.slice(0, expr.length - seg.length);
    setExpr(prefix + formatResult(value));
  }, [error, expr]);

  const toggleSign = useCallback(() => {
    if (error || !expr) return;
    const seg = trailingNumber(expr);
    if (!seg) return;
    const prefix = expr.slice(0, expr.length - seg.length);
    if (prefix.endsWith('−(')) {
      // undo a wrapped negative: −(5 -> 5
      setExpr(prefix.slice(0, -2) + seg);
      return;
    }
    setExpr(prefix + '−(' + seg + ')');
  }, [error, expr]);

  const backspace = useCallback(() => {
    if (error) {
      setError(null);
      setExpr('');
      return;
    }
    if (justEvaluated) {
      setExpr('');
      setJustEvaluated(false);
      return;
    }
    setExpr((prev) => prev.slice(0, -1));
  }, [error, justEvaluated]);

  const clearAll = useCallback(() => {
    setExpr('');
    setError(null);
    setJustEvaluated(false);
  }, []);

  const calculate = useCallback(() => {
    if (!expr) return;
    try {
      const value = evaluateExpression(expr);
      const resultStr = formatResult(value);
      setHistory((prev) => [{ expression: expr, result: resultStr }, ...prev].slice(0, 50));
      setExpr(resultStr);
      setJustEvaluated(true);
      setError(null);
    } catch (err) {
      setError(err instanceof CalculatorError ? err.message : 'Invalid expression');
      setJustEvaluated(false);
    }
  }, [expr]);

  const reuseHistoryEntry = useCallback((entry: HistoryEntry) => {
    setExpr(entry.result);
    setError(null);
    setJustEvaluated(true);
    setShowHistory(false);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  // ---- Keyboard support -----------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        inputDigit(e.key);
        return;
      }
      switch (e.key) {
        case '.':
          inputDecimal();
          break;
        case '+':
          inputOperator('+');
          break;
        case '-':
          inputOperator('−');
          break;
        case '*':
          inputOperator('×');
          break;
        case '/':
          e.preventDefault();
          inputOperator('÷');
          break;
        case '%':
          inputPercent();
          break;
        case '(':
          inputOpenParen();
          break;
        case ')':
          inputCloseParen();
          break;
        case 'Enter':
        case '=':
          e.preventDefault();
          calculate();
          break;
        case 'Backspace':
          backspace();
          break;
        case 'Escape':
          clearAll();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    inputDigit,
    inputDecimal,
    inputOperator,
    inputPercent,
    inputOpenParen,
    inputCloseParen,
    calculate,
    backspace,
    clearAll,
  ]);

  const displayValue = error ? 'Error' : expr === '' ? '0' : expr;

  return (
    <div className="calc">
      <div className="calc__panel">
        <div className="calc__header">
          <span className="calc__title">Calculator</span>
          <button
            type="button"
            className="calc__history-toggle"
            onClick={() => setShowHistory((v) => !v)}
            aria-pressed={showHistory}
            aria-label="Toggle calculation history"
          >
            History
          </button>
        </div>

        <div className={`calc__display ${error ? 'calc__display--error' : ''}`}>
          <div className="calc__expression" title={expr || '0'}>
            {displayValue}
          </div>
          {error && <div className="calc__error-message">{error}</div>}
        </div>

        {showHistory && (
          <div className="calc__history" role="region" aria-label="Calculation history">
            <div className="calc__history-head">
              <span>Recent</span>
              <button
                type="button"
                className="calc__history-clear"
                onClick={clearHistory}
                disabled={history.length === 0}
              >
                Clear
              </button>
            </div>
            {history.length === 0 ? (
              <p className="calc__history-empty">No calculations yet.</p>
            ) : (
              <ul className="calc__history-list">
                {history.map((entry, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => reuseHistoryEntry(entry)}>
                      <span className="calc__history-expr">{entry.expression}</span>
                      <span className="calc__history-eq">=</span>
                      <span className="calc__history-result">{entry.result}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="calc__pad">
          <button type="button" className="key key--func" onClick={inputOpenParen}>(</button>
          <button type="button" className="key key--func" onClick={inputCloseParen}>)</button>
          <button type="button" className="key key--func" onClick={backspace} aria-label="Backspace">⌫</button>
          <button type="button" className="key key--warn" onClick={clearAll}>C</button>

          <button type="button" className="key key--func" onClick={inputPercent}>%</button>
          <button type="button" className="key" onClick={() => inputDigit('7')}>7</button>
          <button type="button" className="key" onClick={() => inputDigit('8')}>8</button>
          <button type="button" className="key" onClick={() => inputDigit('9')}>9</button>

          <button type="button" className="key key--op" onClick={() => inputOperator('÷')}>÷</button>
          <button type="button" className="key" onClick={() => inputDigit('4')}>4</button>
          <button type="button" className="key" onClick={() => inputDigit('5')}>5</button>
          <button type="button" className="key" onClick={() => inputDigit('6')}>6</button>

          <button type="button" className="key key--op" onClick={() => inputOperator('×')}>×</button>
          <button type="button" className="key" onClick={() => inputDigit('1')}>1</button>
          <button type="button" className="key" onClick={() => inputDigit('2')}>2</button>
          <button type="button" className="key" onClick={() => inputDigit('3')}>3</button>

          <button type="button" className="key key--op" onClick={() => inputOperator('−')}>−</button>
          <button type="button" className="key" onClick={toggleSign} aria-label="Toggle sign">±</button>
          <button type="button" className="key" onClick={() => inputDigit('0')}>0</button>
          <button type="button" className="key" onClick={inputDecimal}>.</button>

          <button type="button" className="key key--op" onClick={() => inputOperator('+')}>+</button>
          <button
            type="button"
            className="key key--equals"
            onClick={calculate}
            aria-label="Calculate result"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
}
