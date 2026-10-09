// Lista simplificada de CIDRs de Data Centers para auditoria de tráfego
export const CLOUD_IP_RANGES = {
  aws: [
    '3.5.0.0/16', '3.6.0.0/16', '3.7.0.0/16', '3.8.0.0/16', '3.9.0.0/16',
    '13.32.0.0/15', '13.33.0.0/16', '13.34.0.0/15', '13.35.0.0/16'
  ],
  azure: [
    '13.64.0.0/11', '20.33.0.0/16', '40.74.0.0/15', '52.140.0.0/14'
  ],
  gcp: [
    '34.64.0.0/11', '34.80.0.0/12', '35.184.0.0/13', '35.192.0.0/12'
  ]
};

export function isCloudIP(ip: string): boolean {
  if (!ip) return false;
  // Lógica simplificada de verificação de prefixo para evitar dependências pesadas
  // Em produção, recomenda-se usar a lib 'ipaddr.js' para checagem de CIDR real
  const cloudPrefixes = [
    '3.5.', '3.6.', '3.7.', '3.8.', '3.9.', '13.32.', '13.33.', '13.34.',
    '13.64.', '20.33.', '40.74.', '52.140.', '34.64.', '34.80.', '35.184.', '35.192.'
  ];
  return cloudPrefixes.some(prefix => ip.startsWith(prefix));
}
