/**
 * evaluateExpression
 * ------------------
 * A small, dependency-free recursive-descent parser/evaluator for arithmetic
 * expressions. Deliberately avoids `eval()` / `Function()` for safety.
 *
 * Supported grammar (highest precedence last):
 *   expression := term (('+' | '-') term)*
 *   term       := postfix (('*' | '/') postfix)*
 *   postfix    := unary ('%')*              // trailing % divides by 100
 *   unary      := ('-' | '+') unary | primary
 *   primary    := number | '(' expression ')'
 *
 * Accepts the calculator's display symbols (×, ÷, −) as well as the plain
 * ASCII equivalents (*, /, -).
 */

export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorError';
  }
}

export function evaluateExpression(rawInput: string): number {
  const expr = rawInput
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .trim();

  if (expr.length === 0) {
    throw new CalculatorError('Nothing to calculate');
  }

  let pos = 0;

  const peek = (): string | undefined => expr[pos];
  const consume = (): string => expr[pos++];
  const skipSpaces = (): void => {
    while (expr[pos] === ' ') pos++;
  };

  function parseExpression(): number {
    skipSpaces();
    let value = parseTerm();
    skipSpaces();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
      skipSpaces();
    }
    return value;
  }

  function parseTerm(): number {
    skipSpaces();
    let value = parsePostfix();
    skipSpaces();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const rhs = parsePostfix();
      if (op === '/') {
        if (rhs === 0) throw new CalculatorError("Can't divide by zero");
        value = value / rhs;
      } else {
        value = value * rhs;
      }
      skipSpaces();
    }
    return value;
  }

  function parsePostfix(): number {
    let value = parseUnary();
    skipSpaces();
    while (peek() === '%') {
      consume();
      value = value / 100;
      skipSpaces();
    }
    return value;
  }

  function parseUnary(): number {
    skipSpaces();
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    skipSpaces();
    if (peek() === '(') {
      consume();
      const value = parseExpression();
      skipSpaces();
      if (peek() !== ')') {
        throw new CalculatorError('Missing closing bracket');
      }
      consume();
      return value;
    }

    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;

    if (start === pos) {
      throw new CalculatorError('Invalid expression');
    }

    const numStr = expr.slice(start, pos);
    if ((numStr.match(/\./g) || []).length > 1) {
      throw new CalculatorError('Invalid number format');
    }
    const num = parseFloat(numStr);
    if (Number.isNaN(num)) {
      throw new CalculatorError('Invalid number');
    }
    return num;
  }

  const result = parseExpression();
  skipSpaces();

  if (pos !== expr.length) {
    throw new CalculatorError('Invalid expression');
  }
  if (!Number.isFinite(result)) {
    throw new CalculatorError('Result is too large');
  }

  return result;
}

/** Rounds away floating-point noise and formats a number for display. */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  const rounded = Math.round((n + Number.EPSILON) * 1e10) / 1e10;
  return rounded.toString();
}
