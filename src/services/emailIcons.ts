export const EMAIL_ICONS = {

  logo: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#CC2B2B"/>
    <text x="16" y="22" font-family="Arial" font-size="13"
          font-weight="bold" fill="white" text-anchor="middle">DW</text>
  </svg>`,

  check: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#00C896"/>
    <path d="M7 12l3.5 3.5L17 9" stroke="white" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  shield: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
          fill="#CC2B2B" stroke="#CC2B2B" stroke-width="1"/>
    <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  deposit: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#00C896"/>
    <path d="M12 5v14M5 12l7 7 7-7" stroke="white" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  withdrawal: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#E8A020"/>
    <path d="M12 19V5M5 12l7-7 7 7" stroke="white" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 20h20L12 2z" fill="#E8A020"/>
    <path d="M12 9v5M12 16.5v.5" stroke="white" stroke-width="2"
          stroke-linecap="round"/>
  </svg>`,

  blocked: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#CC2B2B"/>
    <path d="M5 5l14 14M19 5L5 19" stroke="white" stroke-width="2.5"
          stroke-linecap="round"/>
  </svg>`,

  suspended: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#E8A020"/>
    <path d="M8 8h2.5v8H8V8zM13.5 8H16v8h-2.5V8z" fill="white"/>
  </svg>`,

  activated: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#00C896"/>
    <path d="M7 12l3.5 3.5L17 9" stroke="white" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  email: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#CC2B2B"/>
    <path d="M4 8l8 5 8-5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="4" y="7" width="16" height="12" rx="2" stroke="white" stroke-width="1.5"/>
  </svg>`,

  Angola: `<svg width="24" height="16" viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="8" fill="#CC2B2B"/>
    <rect y="8" width="24" height="8" fill="#000000"/>
    <path d="M12 4l1 3h3l-2.5 1.8.95 3.2L12 10.3 9.55 12 10.5 8.8 8 7h3z"
          fill="#FFD700"/>
  </svg>`,
}

export function emailHeader(iconSvg: string, title: string): string {
  return `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;margin-bottom:16px;">
        ${iconSvg}
      </div>
      <div style="margin-top:12px;">
        <div style="display:inline-block;background:#0F1218;border:1px solid rgba(255,255,255,0.07);
                    border-radius:12px;padding:10px 20px;">
          <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
            <tr>
              <td style="vertical-align:middle;padding-right:8px;">${EMAIL_ICONS.logo}</td>
              <td style="vertical-align:middle;font-family:Arial,sans-serif;font-size:18px;
                         font-weight:bold;color:#E8EDF5;">Dynamic Works</td>
            </tr>
          </table>
        </div>
      </div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B7A95;margin:8px 0 0;">
        A primeira broker 100% angolana
      </p>
    </div>
  `
}

export function emailFooter(): string {
  return `
    <div style="border-top:1px solid rgba(255,255,255,0.07);margin-top:32px;padding-top:20px;text-align:center;">
      <div style="display:inline-block;margin-bottom:8px;">
        ${EMAIL_ICONS.Angola}
      </div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B7A95;margin:4px 0 0;">
        &copy; 2025 Dynamic Works &middot; dynamicworks.ao &middot; Luanda, Angola
      </p>
      <p style="font-family:Arial,sans-serif;font-size:11px;color:#3A4459;margin:4px 0 0;">
        Suporte: suporte@dynamicworks.ao
      </p>
    </div>
  `
}
