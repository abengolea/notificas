import type { ReactNode } from "react";

import { SITE_CONTACT, SITE_LEGAL_NAME } from "@/lib/seo";

function TermSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TermList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function BrazilTermsContent() {
  return (
    <>
      <p>
        Estes Termos e Condições regulam o acesso e a contratação dos serviços da plataforma
        Notificas por empresas, organizações, instituições e profissionais que atuem no Brasil.
      </p>
      <p>
        A utilização da plataforma ou a aceitação de proposta comercial, ordem de serviço,
        orçamento ou contratação eletrônica implica a aceitação destes Termos, sem prejuízo das
        condições específicas acordadas entre as partes.
      </p>

      <TermSection title="1. Identificação da prestadora">
        <p>
          O serviço é prestado por <strong>{SITE_LEGAL_NAME}</strong>, sociedade constituída de
          acordo com as leis da República Argentina, CUIT {SITE_CONTACT.cuit}, com sede em Colón
          12, primeiro andar, San Nicolás de los Arroyos, Província de Buenos Aires, Argentina.
        </p>
        <p>
          Contato:{" "}
          <a href={`mailto:${SITE_CONTACT.email}`} className="text-primary underline-offset-4 hover:underline">
            {SITE_CONTACT.email}
          </a>
        </p>
        <p>
          A Notificas poderá prestar seus serviços a clientes localizados no Brasil sem que isso
          implique, por si só, a existência de estabelecimento permanente, filial, sucursal ou
          sociedade constituída no território brasileiro.
        </p>
      </TermSection>

      <TermSection title="2. Natureza e objeto do serviço">
        <p>
          Notificas é uma plataforma tecnológica destinada ao processamento, envio, registro e
          geração de evidências de comunicações digitais.
        </p>
        <p>Os serviços podem compreender, entre outros:</p>
        <TermList
          items={[
            "envio de comunicações por WhatsApp",
            "envio de comunicações por e-mail",
            "processamento de comunicações individuais ou em massa",
            "registro do conteúdo enviado",
            "registro de destinatários",
            "data e hora dos eventos",
            "identificadores técnicos",
            "estados de envio e entrega disponibilizados pelos provedores utilizados",
            "leitura, quando tecnicamente disponibilizada",
            "registro de falhas e tentativas",
            "geração de hash criptográfico",
            "ancoragem de hashes em blockchain",
            "geração de comprovantes ou relatórios individuais",
            "geração de relatórios consolidados",
            "verificação pública de evidências",
            "integrações mediante API",
            "webhooks e outras integrações tecnológicas disponibilizadas pela plataforma",
          ]}
        />
        <p>
          A Notificas presta um <strong>serviço tecnológico de comunicação e geração de evidências digitais</strong>.
        </p>
        <p>
          Os registros gerados pela plataforma não substituem automaticamente eventual forma
          específica exigida por lei, regulamento, contrato ou decisão judicial.
        </p>
      </TermSection>

      <TermSection title="3. Serviços empresariais e operações de alto volume">
        <p>
          A Notificas poderá prestar serviços especiais para empresas e organizações envolvendo
          grandes volumes de comunicações, processamento de bases de destinatários, integrações com
          sistemas internos, API, personalização, automações, relatórios, webhooks e demais
          funcionalidades acordadas entre as partes.
        </p>
        <p>Cada contratação poderá estabelecer condições específicas relativas a:</p>
        <TermList
          items={[
            "volume estimado ou contratado",
            "canais utilizados",
            "valores",
            "moeda",
            "forma de faturamento",
            "periodicidade",
            "níveis de serviço",
            "integrações",
            "cronograma",
            "armazenamento",
            "suporte",
            "tratamento de dados",
            "responsabilidades operacionais",
            "demais condições particulares",
          ]}
        />
        <p>
          Em caso de conflito entre estes Termos e uma proposta comercial, ordem de serviço,
          contrato empresarial ou aditivo expressamente aceito pelas partes,{" "}
          <strong>prevalecerão as condições específicas do instrumento particular</strong>,
          exclusivamente em relação à matéria nele regulada.
        </p>
      </TermSection>

      <TermSection title="4. Cadastro e conta do cliente">
        <p>
          O acesso à plataforma poderá exigir a criação de conta empresarial e contas individuais de
          usuários autorizados pelo cliente.
        </p>
        <p>O cliente é responsável:</p>
        <TermList
          items={[
            "pela veracidade das informações fornecidas",
            "pela administração dos usuários vinculados à sua organização",
            "pela confidencialidade das credenciais",
            "pela utilização das contas",
            "pela revogação de acessos de pessoas que deixem sua organização",
            "por todas as operações realizadas por seus usuários autorizados",
          ]}
        />
        <p>
          A Notificas não será responsável pelo uso indevido de credenciais causado por ação ou
          omissão do cliente ou de seus usuários.
        </p>
      </TermSection>

      <TermSection title="5. Modalidades de contratação">
        <p>Os serviços poderão ser contratados por meio de:</p>
        <TermList
          items={[
            "créditos pré-pagos",
            "planos",
            "assinaturas",
            "consumo",
            "pacotes de volume",
            "contratação por API",
            "proposta comercial",
            "ordem de serviço",
            "contrato empresarial específico",
          ]}
        />
        <p>
          Os valores aplicáveis serão informados no momento da contratação ou na proposta comercial
          correspondente.
        </p>
        <p>A Notificas poderá estabelecer preços diferenciados de acordo com:</p>
        <TermList
          items={[
            "canal",
            "volume",
            "país de destino",
            "tipo de mensagem",
            "recursos utilizados",
            "integrações",
            "armazenamento",
            "nível de suporte",
            "custos de terceiros",
          ]}
        />
      </TermSection>

      <TermSection title="6. Moeda, faturamento e pagamentos internacionais">
        <p>
          Salvo previsão diferente na proposta comercial, os serviços destinados a clientes
          internacionais poderão ser cotados e faturados em{" "}
          <strong>dólares dos Estados Unidos da América (USD)</strong>.
        </p>
        <p>As partes poderão acordar faturamento ou pagamento em outra moeda.</p>
        <p>
          O cliente será responsável pelos custos bancários, cambiais ou financeiros que sejam de
          sua responsabilidade na operação de pagamento internacional.
        </p>
        <p>
          Tributos, retenções, impostos ou encargos incidentes no Brasil sobre a contratação,
          importação ou pagamento de serviços provenientes do exterior serão tratados conforme a
          legislação aplicável e as condições estabelecidas na proposta comercial.
        </p>
        <p>
          Caso a legislação brasileira imponha retenção na fonte ou outro desconto obrigatório sobre
          valores devidos à Notificas, o cliente deverá informar previamente tal circunstância e
          fornecer os comprovantes fiscais correspondentes.
        </p>
        <p>
          Eventuais mecanismos de gross-up, absorção de retenções ou repartição de encargos deverão
          ser definidos na proposta comercial ou contrato empresarial específico.
        </p>
      </TermSection>

      <TermSection title="7. Custos de WhatsApp Business Platform">
        <p>
          Quando o serviço utilizar WhatsApp Business Platform, poderão existir custos cobrados
          pela Meta ou por outros prestadores envolvidos na operação.
        </p>
        <p>Esses custos poderão:</p>
        <TermList
          items={[
            "estar incluídos no preço da Notificas; ou",
            "ser cobrados separadamente do cliente,",
          ]}
        />
        <p>conforme estabelecido na proposta comercial.</p>
        <p>Os valores cobrados pela Meta podem variar de acordo com fatores como:</p>
        <TermList
          items={[
            "país do destinatário",
            "categoria da mensagem",
            "volume",
            "política comercial vigente",
            "características da conta",
            "demais critérios definidos pela Meta",
          ]}
        />
        <p>
          A Meta poderá alterar suas tarifas, políticas, categorias, limites ou condições
          independentemente da Notificas.
        </p>
        <p>
          Caso essas alterações modifiquem os custos da operação, a Notificas poderá ajustar os
          preços correspondentes, mediante comunicação ao cliente.
        </p>
      </TermSection>

      <TermSection title="8. WhatsApp Business Platform">
        <p>A utilização do WhatsApp está sujeita às regras técnicas e comerciais definidas pela Meta.</p>
        <p>Podem depender exclusivamente da Meta:</p>
        <TermList
          items={[
            "aprovação de templates",
            "classificação da categoria da mensagem",
            "limites de capacidade",
            "qualidade da conta",
            "disponibilidade",
            "entrega",
            "bloqueios",
            "restrições",
            "suspensão de números ou contas",
            "critérios de faturamento",
            "demais funcionalidades da plataforma",
          ]}
        />
        <p>
          A Notificas não garante que a Meta aprove determinado template, conteúdo, categoria
          tarifária, número, volume ou incremento de capacidade.
        </p>
      </TermSection>

      <TermSection title="9. E-mail">
        <p>
          As comunicações por e-mail poderão ser processadas por meio de infraestrutura própria ou
          provedores tecnológicos contratados pela Notificas.
        </p>
        <p>
          A aceitação de uma mensagem por um servidor SMTP não significa necessariamente que a
          mensagem tenha sido disponibilizada ou visualizada na caixa postal do destinatário.
        </p>
        <p>
          A plataforma registrará os eventos que estejam tecnicamente disponíveis para cada
          comunicação.
        </p>
      </TermSection>

      <TermSection title="10. Bases de destinatários">
        <p>
          Quando o cliente fornecer números telefônicos, endereços de e-mail, nomes, CPFs, CNPJs,
          identificadores, documentos ou quaisquer outros dados relacionados aos destinatários,
          declara que possui fundamento jurídico adequado para realizar o respectivo tratamento e
          solicitar as comunicações.
        </p>
        <p>O cliente é responsável pela:</p>
        <TermList
          items={[
            "origem da base",
            "legitimidade de sua utilização",
            "exatidão",
            "atualização",
            "vinculação entre os dados e o destinatário",
            "finalidade do tratamento",
            "conteúdo das comunicações",
            "observância das obrigações legais e regulatórias relacionadas à sua atividade",
          ]}
        />
        <p>
          A Notificas não realiza investigação autônoma sobre a origem de cada dado recebido do
          cliente.
        </p>
      </TermSection>

      <TermSection title="11. Conteúdo das comunicações">
        <p>O cliente é exclusivamente responsável pelo conteúdo cuja transmissão solicitar.</p>
        <p>É proibido utilizar a plataforma para:</p>
        <TermList
          items={[
            "fraude",
            "spam ilícito",
            "phishing",
            "falsidade",
            "suplantação de identidade",
            "assédio",
            "práticas abusivas",
            "comunicações ilegais",
            "violação de direitos de terceiros",
            "utilização contrária às políticas da Meta",
            "qualquer finalidade proibida pela legislação aplicável",
          ]}
        />
        <p>
          A Notificas poderá suspender ou recusar operações quando identificar risco relevante de
          fraude, ilicitude, abuso, violação regulatória ou descumprimento das políticas dos
          provedores utilizados.
        </p>
      </TermSection>

      <TermSection title="12. Estados de envio, entrega e leitura">
        <p>A Notificas registra os eventos disponibilizados pelos serviços tecnológicos utilizados.</p>
        <p>No WhatsApp poderão ser registrados, conforme o caso:</p>
        <TermList
          items={[
            "processado",
            "enviado",
            "aceito",
            "entregue",
            "lido",
            "falhou",
            "demais eventos disponibilizados pela Meta",
          ]}
        />
        <p>No e-mail poderão ser registrados, conforme tecnicamente disponível:</p>
        <TermList
          items={[
            "processamento",
            "envio",
            "aceitação pelo servidor",
            "entrega",
            "acesso",
            "abertura",
            "clique",
            "erro",
            "rejeição",
            "bounce",
            "demais eventos disponibilizados pelo provedor utilizado",
          ]}
        />
        <p>Nem todos os eventos estarão disponíveis em todas as comunicações.</p>
        <p>
          A existência de um registro de entrega não significa necessariamente que o destinatário
          tenha lido ou compreendido o conteúdo.
        </p>
        <p>
          Da mesma forma, a ausência de registro de leitura não significa necessariamente ausência
          de conhecimento da comunicação.
        </p>
      </TermSection>

      <TermSection title="13. Falhas de comunicação">
        <p>
          A Notificas não garante entrega ou leitura quando isso depender de circunstâncias fora de
          seu controle.
        </p>
        <p>Entre outras:</p>
        <TermList
          items={[
            "telefone inexistente",
            "telefone incorreto",
            "número sem WhatsApp",
            "bloqueio pelo destinatário",
            "conta cancelada",
            "caixa postal inexistente",
            "endereço eletrônico incorreto",
            "filtros antispam",
            "servidor indisponível",
            "rejeição pelo provedor",
            "restrições impostas pela Meta",
            "falhas de operadores de telecomunicações",
            "interrupções de Internet",
            "medidas de segurança do destinatário",
            "força maior",
          ]}
        />
        <p>
          Quando contratado, o serviço poderá utilizar novas tentativas ou canais alternativos.
        </p>
      </TermSection>

      <TermSection title="14. Evidências digitais">
        <p>
          Para cada comunicação, a Notificas poderá gerar registros técnicos contendo, conforme o
          canal e as funcionalidades contratadas:
        </p>
        <TermList
          items={[
            "conteúdo",
            "destinatário",
            "data e hora",
            "identificador interno",
            "identificador do provedor",
            "eventos de processamento",
            "envio",
            "entrega",
            "leitura quando disponível",
            "falhas",
            "tentativas",
            "hash criptográfico",
            "documentos vinculados",
            "comprovante individual",
            "histórico técnico",
            "elementos de auditoria",
          ]}
        />
        <p>
          Esses registros constituem <strong>evidências técnicas digitais</strong> da operação
          realizada pela plataforma.
        </p>
      </TermSection>

      <TermSection title="15. Blockchain e integridade criptográfica">
        <p>
          A Notificas poderá gerar hashes criptográficos associados ao conteúdo ou ao expediente
          eletrônico e registrar ou ancorar esses hashes em redes blockchain, incluindo Polygon ou
          outras tecnologias que venham a ser utilizadas.
        </p>
        <p>
          Salvo indicação expressa em sentido contrário,{" "}
          <strong>
            o conteúdo da comunicação e os dados pessoais do destinatário não são publicados
            diretamente na blockchain
          </strong>
          .
        </p>
        <p>
          O registro blockchain tem por finalidade permitir a verificação posterior da existência e
          integridade do hash correspondente.
        </p>
        <p>As transações realizadas em redes blockchain públicas podem possuir caráter permanente.</p>
        <p>
          Tal circunstância não significa que todos os dados pessoais tratados pela plataforma
          sejam armazenados permanentemente em blockchain.
        </p>
      </TermSection>

      <TermSection title="16. Valor probatório">
        <p>
          Os comprovantes, relatórios, registros, hashes e demais documentos gerados pela Notificas
          constituem evidências técnicas digitais.
        </p>
        <p>Sua admissibilidade, força ou eficácia probatória dependerá:</p>
        <TermList
          items={[
            "da legislação aplicável",
            "da natureza da comunicação",
            "da finalidade",
            "do contrato",
            "das circunstâncias concretas",
            "da apreciação da autoridade administrativa, judicial ou arbitral competente",
          ]}
        />
        <p>
          A Notificas não garante resultado específico em processo judicial, administrativo,
          arbitral ou regulatório.
        </p>
        <p>
          O serviço não substitui formas legais específicas quando a legislação exigir, por
          exemplo, comunicação judicial, ato notarial, carta registrada, publicação oficial ou
          outro meio determinado.
        </p>
      </TermSection>

      <TermSection title="17. Proteção de dados pessoais — LGPD">
        <p>
          Quando forem tratados dados pessoais sujeitos à Lei brasileira nº 13.709/2018 — Lei Geral
          de Proteção de Dados Pessoais — as partes comprometem-se a observar as obrigações que
          lhes sejam aplicáveis.
        </p>
        <p>Como regra geral da prestação empresarial, o cliente determina:</p>
        <TermList
          items={[
            "as finalidades da comunicação",
            "os destinatários",
            "a base de dados",
            "o conteúdo",
            "a base legal",
            "os períodos e critérios da operação",
          ]}
        />
        <p>
          Nessas situações, o cliente atua, em regra, como <strong>controlador</strong>, e a
          Notificas atua como <strong>operador</strong>, processando os dados de acordo com as
          instruções documentadas do cliente.
        </p>
        <p>
          Essa qualificação poderá ser diferente quando, em determinada operação, a natureza
          efetiva das decisões tomadas por cada parte resultar em enquadramento jurídico distinto.
        </p>
        <p>O cliente é responsável por determinar a base legal adequada para o tratamento.</p>
        <p>
          A Notificas não presume que o consentimento seja necessariamente a base jurídica
          aplicável a toda comunicação.
        </p>
      </TermSection>

      <TermSection title="18. Finalidade e minimização">
        <p>
          A Notificas processará os dados recebidos do cliente para as finalidades necessárias à
          execução do serviço contratado, incluindo:
        </p>
        <TermList
          items={[
            "processamento da comunicação",
            "envio",
            "registro de eventos",
            "geração de evidências",
            "segurança",
            "prevenção a fraude",
            "suporte",
            "auditoria",
            "cumprimento de obrigações legais",
            "defesa de direitos",
          ]}
        />
        <p>
          A Notificas adotará medidas destinadas a limitar o tratamento aos dados razoavelmente
          necessários à execução dessas finalidades.
        </p>
      </TermSection>

      <TermSection title="19. Transferência internacional de dados">
        <p>
          O cliente reconhece que a {SITE_LEGAL_NAME} está estabelecida na República Argentina e
          que a prestação dos serviços poderá envolver{" "}
          <strong>transferência internacional de dados pessoais</strong>, inclusive entre Brasil e
          Argentina, além do eventual tratamento por suboperadores localizados em outros países.
        </p>
        <p>
          As transferências internacionais de dados pessoais sujeitos à LGPD deverão observar os
          mecanismos legalmente aplicáveis previstos na legislação brasileira e na regulamentação
          da Autoridade Nacional de Proteção de Dados — ANPD.
        </p>
        <p>
          Quando necessário, as partes adotarão instrumento específico para disciplinar a
          transferência internacional.
        </p>
        <p>
          Caso a transferência se baseie nas{" "}
          <strong>Cláusulas-Padrão Contratuais aprovadas pela ANPD</strong>, estas deverão ser
          incorporadas ao instrumento aplicável em sua versão oficial, integral e sem alterações
          incompatíveis com a regulamentação vigente.
        </p>
        <p>
          As condições específicas de transferência, categorias de dados, finalidade, agentes
          envolvidos, países de destino e mecanismos aplicáveis poderão constar de{" "}
          <strong>Anexo de Tratamento e Transferência Internacional de Dados</strong>.
        </p>
      </TermSection>

      <TermSection title="20. Suboperadores e provedores tecnológicos">
        <p>
          Para prestar seus serviços, a Notificas poderá contratar provedores tecnológicos,
          incluindo, conforme aplicável:
        </p>
        <TermList
          items={[
            "Meta",
            "provedores de infraestrutura em nuvem",
            "provedores de e-mail",
            "bancos de dados",
            "armazenamento",
            "segurança",
            "processamento",
            "monitoramento",
            "blockchain",
            "serviços de pagamento",
            "outros fornecedores indispensáveis à operação",
          ]}
        />
        <p>
          A Notificas adotará medidas razoáveis para selecionar fornecedores compatíveis com os
          requisitos de segurança e proteção de dados aplicáveis.
        </p>
        <p>
          Quando exigido por contrato, a lista de suboperadores relevantes poderá ser disponibilizada
          ao cliente.
        </p>
      </TermSection>

      <TermSection title="21. Segurança da informação">
        <p>
          A Notificas adotará medidas técnicas e organizacionais razoáveis e compatíveis com a
          natureza do serviço para proteger os dados contra:
        </p>
        <TermList
          items={[
            "acesso não autorizado",
            "perda",
            "alteração indevida",
            "destruição",
            "divulgação indevida",
            "incidentes de segurança",
          ]}
        />
        <p>Nenhum ambiente tecnológico pode ser considerado absolutamente imune a incidentes.</p>
        <p>
          A ocorrência de incidente será tratada de acordo com a legislação aplicável e as
          obrigações contratuais assumidas entre as partes.
        </p>
      </TermSection>

      <TermSection title="22. Conservação dos dados e das evidências">
        <p>
          A Notificas conservará os dados pessoais, documentos e evidências pelo período necessário
          para:
        </p>
        <TermList
          items={[
            "prestação do serviço",
            "cumprimento da finalidade contratada",
            "atendimento de obrigações legais ou regulatórias",
            "exercício regular de direitos",
            "prevenção a fraude",
            "observância do prazo de conservação contratado",
          ]}
        />
        <p>
          O período específico de armazenamento de evidências poderá ser definido na proposta
          comercial.
        </p>
        <p>
          Documentos destinados a preservar evidências poderão ser mantidos durante o período
          contratualmente estabelecido, desde que exista fundamento jurídico para sua conservação.
        </p>
        <p>
          Após o término do prazo aplicável, os dados poderão ser eliminados, anonimizados ou
          mantidos quando houver fundamento legal para conservação.
        </p>
        <p>
          Hashes ou registros técnicos já gravados em blockchain pública poderão permanecer na
          respectiva rede de acordo com as características tecnológicas da blockchain, sem que isso
          implique necessariamente a permanência do conteúdo original ou dos dados pessoais
          utilizados para sua geração.
        </p>
      </TermSection>

      <TermSection title="23. Solicitações de titulares">
        <p>
          Quando a Notificas atuar como operador, as solicitações relativas a direitos de titulares
          deverão, como regra, ser encaminhadas ao cliente controlador.
        </p>
        <p>
          A Notificas prestará a cooperação razoavelmente necessária para que o cliente possa
          responder às solicitações no âmbito das funcionalidades e responsabilidades contratadas.
        </p>
      </TermSection>

      <TermSection title="24. Confidencialidade">
        <p>
          Cada parte deverá tratar como confidenciais as informações comerciais, técnicas,
          operacionais, estratégicas e demais informações não públicas recebidas da outra parte.
        </p>
        <p>A obrigação não se aplica a informações que:</p>
        <TermList
          items={[
            "já fossem públicas legitimamente",
            "se tornem públicas sem violação contratual",
            "tenham sido obtidas legitimamente de terceiro",
            "devam ser divulgadas por obrigação legal ou ordem de autoridade competente",
          ]}
        />
      </TermSection>

      <TermSection title="25. Disponibilidade e dependência de terceiros">
        <p>A plataforma depende de diferentes serviços de terceiros.</p>
        <p>A Notificas não será responsável por indisponibilidades diretamente causadas por:</p>
        <TermList
          items={[
            "Meta",
            "serviços de e-mail",
            "provedores de nuvem",
            "provedores de telecomunicações",
            "Internet",
            "redes blockchain",
            "sistemas bancários",
            "outros fornecedores fora de seu controle razoável",
          ]}
        />
        <p>Quando houver SLA contratado, suas condições específicas prevalecerão.</p>
      </TermSection>

      <TermSection title="26. Suspensão">
        <p>A Notificas poderá suspender total ou parcialmente a prestação em caso de:</p>
        <TermList
          items={[
            "inadimplemento",
            "fraude",
            "risco de segurança",
            "uso ilícito",
            "violação destes Termos",
            "violação das políticas de terceiros",
            "determinação de autoridade",
            "risco relevante à infraestrutura",
            "necessidade de manutenção emergencial",
          ]}
        />
        <p>Sempre que razoavelmente possível, o cliente será previamente comunicado.</p>
      </TermSection>

      <TermSection title="27. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela legislação aplicável, a Notificas não responderá por
          danos indiretos, lucros cessantes, perda de oportunidades comerciais ou consequências
          derivadas de atos, informações ou decisões sob responsabilidade do cliente.
        </p>
        <p>
          Nos serviços empresariais, salvo dolo, culpa grave ou hipótese em que a limitação seja
          proibida por norma imperativa, a responsabilidade patrimonial total da Notificas ficará
          limitada ao valor efetivamente pago pelo cliente pelos serviços que deram origem à
          reclamação durante os <strong>seis meses imediatamente anteriores ao evento</strong>.
        </p>
        <p>Uma proposta comercial ou contrato específico poderá estabelecer limite diferente.</p>
        <p>
          As limitações previstas nesta cláusula não afastam responsabilidades que não possam ser
          legalmente excluídas ou limitadas.
        </p>
      </TermSection>

      <TermSection title="28. Propriedade intelectual">
        <p>
          A plataforma, software, interfaces, código, marcas, desenhos, documentação, APIs e demais
          elementos tecnológicos da Notificas pertencem à {SITE_LEGAL_NAME} ou a seus respectivos
          licenciantes.
        </p>
        <p>A contratação não transfere direitos de propriedade intelectual ao cliente.</p>
        <p>
          O cliente mantém a titularidade ou os direitos que legitimamente possua sobre os
          conteúdos e documentos que fornecer.
        </p>
      </TermSection>

      <TermSection title="29. Vigência e encerramento">
        <p>
          A contratação permanecerá vigente pelo período estabelecido no plano, assinatura,
          proposta comercial ou ordem de serviço aplicável.
        </p>
        <p>Cada instrumento poderá estabelecer:</p>
        <TermList
          items={[
            "período mínimo",
            "renovação",
            "aviso prévio",
            "cancelamento",
            "efeitos do encerramento",
            "tratamento de créditos",
            "exportação de evidências",
            "retenção ou eliminação de dados",
          ]}
        />
      </TermSection>

      <TermSection title="30. Modificações destes Termos">
        <p>A Notificas poderá atualizar estes Termos em razão de alterações:</p>
        <TermList
          items={[
            "legislativas",
            "regulatórias",
            "tecnológicas",
            "operacionais",
            "comerciais",
            "das políticas dos provedores utilizados",
          ]}
        />
        <p>Alterações relevantes serão comunicadas ao cliente com antecedência razoável.</p>
        <p>
          Quando existir contrato empresarial com prazo determinado, alterações destes Termos não
          modificarão condições comerciais expressamente pactuadas, salvo acordo entre as partes ou
          necessidade decorrente de norma obrigatória ou alteração de fornecedor externo.
        </p>
      </TermSection>

      <TermSection title="31. Contratação empresarial">
        <p>
          Estes Termos foram elaborados para relações{" "}
          <strong>B2B — business to business</strong>.
        </p>
        <p>
          A pessoa que aceitar estes Termos em nome de empresa ou organização declara possuir
          poderes suficientes para vinculá-la.
        </p>
        <p>
          Nada nestes Termos pretende afastar normas imperativas que sejam obrigatoriamente
          aplicáveis à relação concreta.
        </p>
      </TermSection>

      <TermSection title="32. Comunicações entre as partes">
        <p>
          As comunicações relacionadas ao contrato poderão ser realizadas eletronicamente pelos
          endereços registrados pelas partes.
        </p>
        <p>
          Consideram-se válidas, para fins contratuais, as comunicações realizadas por e-mail ou
          pelos canais eletrônicos expressamente informados na contratação, sem prejuízo de forma
          distinta exigida por lei.
        </p>
      </TermSection>

      <TermSection title="33. Lei aplicável e jurisdição">
        <p>
          Salvo disposição diferente em proposta comercial ou contrato específico, estes Termos e a
          relação contratual serão regidos pelas leis da <strong>República Argentina</strong>, sem
          prejuízo da aplicação das normas brasileiras de caráter imperativo que incidam sobre
          operações realizadas no Brasil, particularmente as relativas à proteção de dados pessoais.
        </p>
        <p>
          As partes elegem, para as controvérsias decorrentes da relação contratual, os tribunais
          ordinários da cidade de{" "}
          <strong>San Nicolás de los Arroyos, Província de Buenos Aires, Argentina</strong>, com
          renúncia a qualquer outro foro que pudesse corresponder, na medida legalmente permitida.
        </p>
        <p>
          Em contratos empresariais de maior porte, as partes poderão acordar mecanismo distinto de
          resolução de disputas, incluindo mediação ou arbitragem internacional, mediante
          instrumento específico.
        </p>
      </TermSection>

      <TermSection title="34. Disposições finais">
        <p>
          A eventual invalidade ou inexigibilidade de uma disposição destes Termos não afetará as
          demais.
        </p>
        <p>
          A tolerância de qualquer das partes em relação ao descumprimento de determinada obrigação
          não implicará renúncia de direitos.
        </p>
        <p>A versão vigente destes Termos estará disponível no site da Notificas.</p>
        <p>
          Em caso de existência de versões em idiomas diferentes, o contrato ou proposta comercial
          aplicável poderá definir qual versão prevalecerá para fins de interpretação.
        </p>
      </TermSection>

      <section className="border-t pt-6">
        <p>
          <strong>{SITE_LEGAL_NAME}</strong>
          <br />
          CUIT {SITE_CONTACT.cuit}
          <br />
          San Nicolás de los Arroyos, Buenos Aires, Argentina
          <br />
          <a href={`mailto:${SITE_CONTACT.email}`} className="text-primary underline-offset-4 hover:underline">
            {SITE_CONTACT.email}
          </a>
        </p>
      </section>
    </>
  );
}
