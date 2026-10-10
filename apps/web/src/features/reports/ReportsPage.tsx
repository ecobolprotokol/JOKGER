import { useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { ErrorState } from '../../shared/components/ErrorState';
import { Money } from '../../shared/components/Money';
import { Stat } from '../../shared/components/Stat';
import { Chart } from '../../shared/components/Chart';
import { PageHeader } from '../../shared/components/PageHeader';
import { downloadCsv, generateCsvFilename, toCsv } from '../../shared/lib/csv';
import { formatDate, formatNumber } from '../../shared/lib/format';
import { toAppError } from '../../shared/lib/errors';
import { strings } from '../../shared/strings/id';
import { useSalesReport } from './hooks';
import { hourlySeries, inclusiveRangeDays, jakartaToday } from './logic';
import type { ReportRange, SalesReport } from './schemas';

type ReportTab = 'daily' | 'hourly' | 'method' | 'category' | 'item' | 'voucher';

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function ReportsPage(): JSX.Element {
  const today = jakartaToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [appliedRange, setAppliedRange] = useState<ReportRange | null>({ from: today, to: today });
  const [rangeError, setRangeError] = useState(false);
  const [tab, setTab] = useState<ReportTab>('daily');
  const query = useSalesReport(appliedRange ?? { from, to }, Boolean(appliedRange));
  const report = appliedRange ? query.data : undefined;
  const largestMethodTotal = Math.max(...(report?.byMethod.map((row) => row.totalSales) ?? [0]), 1);

  function applyRange(next: ReportRange): void {
    const days = inclusiveRangeDays(next);
    if (days === null || days > 366) {
      setRangeError(true);
      setAppliedRange(null);
      return;
    }
    setRangeError(false);
    setFrom(next.from);
    setTo(next.to);
    setAppliedRange(next);
  }

  function setPreset(preset: 'today' | 'last7' | 'month'): void {
    const end = jakartaToday();
    const start =
      preset === 'today' ? end : preset === 'last7' ? addDays(end, -6) : `${end.slice(0, 7)}-01`;
    applyRange({ from: start, to: end });
  }

  function exportCurrentTab(data: SalesReport): void {
    let csv = '';
    if (tab === 'daily') {
      csv = toCsv(
        data.daily.map((row) => ({
          date: row.date,
          sales: row.totalSales,
          transactions: row.totalTransactions,
        })),
        [
          { key: 'date', header: strings.reports.date },
          { key: 'sales', header: strings.reports.totalSales },
          { key: 'transactions', header: strings.reports.transactions },
        ],
      );
    } else if (tab === 'hourly') {
      const hours = hourlySeries(data);
      csv = toCsv(
        hours.labels.map((hour, index) => ({ hour, sales: hours.values[index] ?? 0 })),
        [
          { key: 'hour', header: strings.reports.hour },
          { key: 'sales', header: strings.reports.totalSales },
        ],
      );
    } else if (tab === 'method') {
      csv = toCsv(
        data.byMethod.map((row) => ({
          method: strings.reports.methods[row.method],
          sales: row.totalSales,
        })),
        [
          { key: 'method', header: strings.reports.method },
          { key: 'sales', header: strings.reports.totalSales },
        ],
      );
    } else if (tab === 'category') {
      csv = toCsv(data.byCategory, [
        { key: 'categoryName', header: strings.reports.category },
        { key: 'totalQty', header: strings.reports.quantity },
        { key: 'totalSales', header: strings.reports.totalSales },
      ]);
    } else if (tab === 'item') {
      csv = toCsv(
        [
          ...data.byItem.map((row) => ({
            name: row.itemName,
            category: row.categoryName,
            quantity: row.totalQty,
            sales: row.totalSales,
          })),
          {
            name: strings.reports.voucherDiscount,
            category: '',
            quantity: '',
            sales: -data.summary.totalDiscount,
          },
        ],
        [
          { key: 'name', header: strings.reports.item },
          { key: 'category', header: strings.reports.category },
          { key: 'quantity', header: strings.reports.quantity },
          { key: 'sales', header: strings.reports.totalSales },
        ],
      );
    } else {
      csv = toCsv(data.byVoucher, [
        { key: 'code', header: strings.reports.code },
        { key: 'name', header: strings.reports.voucher },
        { key: 'usageCount', header: strings.reports.usage },
        { key: 'totalDiscount', header: strings.reports.totalDiscount },
      ]);
    }
    downloadCsv(csv, generateCsvFilename(`laporan-${tab}`));
  }

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'daily', label: strings.reports.daily },
    { id: 'hourly', label: strings.reports.hourly },
    { id: 'method', label: strings.reports.method },
    { id: 'category', label: strings.reports.category },
    { id: 'item', label: strings.reports.item },
    { id: 'voucher', label: strings.reports.voucher },
  ];

  return (
    <main className="reports-page">
      <PageHeader title={strings.reports.title} />
      <section className="report-filter" aria-label={strings.reports.filters}>
        <div className="report-presets" role="group" aria-label={strings.reports.datePresets}>
          <button className="button button--secondary" onClick={() => setPreset('today')}>
            {strings.reports.today}
          </button>
          <button className="button button--secondary" onClick={() => setPreset('last7')}>
            {strings.reports.last7Days}
          </button>
          <button className="button button--secondary" onClick={() => setPreset('month')}>
            {strings.reports.thisMonth}
          </button>
        </div>
        <label className="field">
          <span>{strings.reports.from}</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>{strings.reports.to}</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="button button--primary" onClick={() => applyRange({ from, to })}>
          {strings.reports.apply}
        </button>
      </section>
      {rangeError && (
        <p className="form-alert" role="alert">
          {strings.reports.rangeInvalid}
        </p>
      )}
      {query.isPending && appliedRange && (
        <div className="page-state" role="status">
          {strings.app.loading}
        </div>
      )}
      {query.isError && appliedRange && (
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      )}
      {report &&
        (report.summary.totalTransactions === 0 ? (
          <section className="orders-empty" role="status">
            <BarChart3 size={28} aria-hidden="true" />
            <h2>{strings.reports.empty}</h2>
          </section>
        ) : (
          <>
            <section className="report-summary" aria-label={strings.reports.summary}>
              <Stat
                label={strings.reports.totalSales}
                value={<Money value={report.summary.totalSales} signed />}
              />
              <Stat
                label={strings.reports.transactions}
                value={formatNumber(report.summary.totalTransactions)}
              />
              <Stat
                label={strings.reports.average}
                value={<Money value={report.summary.avgTransaction} />}
              />
              <Stat
                label={strings.reports.refund}
                value={<Money value={report.summary.totalRefund} />}
              />
              <Stat
                label={strings.reports.totalDiscount}
                value={<Money value={report.summary.totalDiscount} />}
              />
              <Stat
                label={strings.reports.serviceAndTax}
                value={<Money value={report.summary.totalService + report.summary.totalTax} />}
              />
              <Stat
                label={strings.reports.void}
                value={<Money value={report.summary.totalVoid} />}
              />
            </section>
            <p className="report-note">{strings.reports.timezoneNote}</p>
            <nav className="report-tabs" role="tablist" aria-label={strings.reports.tabs}>
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'is-active' : ''}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <section
              className="report-table-panel"
              role="tabpanel"
              aria-label={tabs.find((item) => item.id === tab)?.label}
            >
              <div className="report-table-panel__heading">
                <h2>{tabs.find((item) => item.id === tab)?.label}</h2>
                <button
                  className="button button--secondary"
                  onClick={() => exportCurrentTab(report)}
                >
                  <Download size={16} aria-hidden="true" />
                  {strings.reports.downloadCsv}
                </button>
              </div>
              {tab === 'daily' && (
                <>
                  <Chart
                    kind="bar"
                    labels={report.daily.map((row) => row.date.slice(5))}
                    series={[
                      {
                        label: strings.reports.totalSales,
                        data: report.daily.map((row) => row.totalSales),
                      },
                    ]}
                    formatValue={(value) => formatNumber(value)}
                  />
                  <div className="inventory-table-wrap">
                    <table className="inventory-table">
                      <caption className="visually-hidden">{strings.reports.daily}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{strings.reports.date}</th>
                          <th scope="col">{strings.reports.totalSales}</th>
                          <th scope="col">{strings.reports.transactions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.daily.map((row) => (
                          <tr key={row.date}>
                            <th scope="row">{formatDate(`${row.date}T12:00:00+07:00`)}</th>
                            <td>
                              <Money value={row.totalSales} signed />
                            </td>
                            <td>{formatNumber(row.totalTransactions)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {tab === 'hourly' &&
                (() => {
                  const hours = hourlySeries(report);
                  return (
                    <>
                      <Chart
                        kind="bar"
                        labels={hours.labels}
                        series={[{ label: strings.reports.totalSales, data: hours.values }]}
                        formatValue={(value) => formatNumber(value)}
                      />
                      <div className="inventory-table-wrap">
                        <table className="inventory-table">
                          <caption className="visually-hidden">{strings.reports.hourly}</caption>
                          <thead>
                            <tr>
                              <th scope="col">{strings.reports.hour}</th>
                              <th scope="col">{strings.reports.totalSales}</th>
                              <th scope="col">{strings.reports.transactions}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hours.labels.map((hour, index) => (
                              <tr key={hour}>
                                <th scope="row">{hour}.00</th>
                                <td>
                                  <Money value={hours.values[index] ?? 0} signed />
                                </td>
                                <td>
                                  {formatNumber(
                                    report.hourly.find((row) => row.hour === index)
                                      ?.totalTransactions ?? 0,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              {tab === 'method' && (
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <caption className="visually-hidden">{strings.reports.method}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{strings.reports.method}</th>
                        <th scope="col">{strings.reports.totalSales}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byMethod.map((row) => (
                        <tr key={row.method}>
                          <th scope="row">{strings.reports.methods[row.method]}</th>
                          <td>
                            <div className="report-method-value">
                              <span className="report-method-bar" aria-hidden="true">
                                <span
                                  style={{
                                    width: `${(row.totalSales / largestMethodTotal) * 100}%`,
                                  }}
                                />
                              </span>
                              <Money value={row.totalSales} signed />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === 'category' && (
                <>
                  <Chart
                    kind="bar"
                    labels={report.byCategory.map((row) => row.categoryName)}
                    series={[
                      {
                        label: strings.reports.totalSales,
                        data: report.byCategory.map((row) => row.totalSales),
                      },
                    ]}
                    formatValue={(value) => formatNumber(value)}
                  />
                  <div className="inventory-table-wrap">
                    <table className="inventory-table">
                      <caption className="visually-hidden">{strings.reports.category}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{strings.reports.category}</th>
                          <th scope="col">{strings.reports.quantity}</th>
                          <th scope="col">{strings.reports.totalSales}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byCategory.map((row) => (
                          <tr key={row.categoryName}>
                            <th scope="row">{row.categoryName}</th>
                            <td>{formatNumber(row.totalQty)}</td>
                            <td>
                              <Money value={row.totalSales} signed />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {tab === 'item' && (
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <caption className="visually-hidden">{strings.reports.item}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{strings.reports.item}</th>
                        <th scope="col">{strings.reports.category}</th>
                        <th scope="col">{strings.reports.quantity}</th>
                        <th scope="col">{strings.reports.totalSales}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byItem.map((row, index) => (
                        <tr key={`${row.itemName}-${row.categoryName}-${index}`}>
                          <th scope="row">{row.itemName}</th>
                          <td>{row.categoryName}</td>
                          <td>{formatNumber(row.totalQty)}</td>
                          <td>
                            <Money value={row.totalSales} signed />
                          </td>
                        </tr>
                      ))}
                      <tr className="report-discount-row">
                        <th scope="row" colSpan={3}>
                          {strings.reports.voucherDiscount}
                        </th>
                        <td>
                          <Money value={-report.summary.totalDiscount} signed />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {tab === 'voucher' && (
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <caption className="visually-hidden">{strings.reports.voucher}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{strings.reports.code}</th>
                        <th scope="col">{strings.reports.voucher}</th>
                        <th scope="col">{strings.reports.usage}</th>
                        <th scope="col">{strings.reports.totalDiscount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byVoucher.map((row) => (
                        <tr key={row.code}>
                          <th scope="row">{row.code}</th>
                          <td>{row.name}</td>
                          <td>{formatNumber(row.usageCount)}</td>
                          <td>
                            <Money value={row.totalDiscount} signed />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ))}
    </main>
  );
}
