"""Per-site generated contracts, actual pinned SDK/direct VM; scripted cross reads."""
import ast
import cloudpickle
import json
import re
import subprocess
from pathlib import Path
from types import SimpleNamespace
import pytest

ROOT=Path(__file__).resolve().parents[2]
SITES=json.loads((ROOT/'contracts/island_fixtures.json').read_text(encoding='utf-8'))
CASES=json.loads((ROOT/'tests/direct/genlayer-cases.json').read_text(encoding='utf-8'))
PASS={'decision':'approve','feedback':'Independent scripted site judgment.'}
PUMP_PASS={'decision':'approve','evidenceQuote':'Village water shortage','feedback':'This build fits the fixed shortage scenario.'}
RUN='0x'+'e'*64
PLAN='A concrete, safe repair plan with regular maintenance.'

def judgment(site,decision='approve'):
    result=PUMP_PASS if site['id']=='village_pump' else PASS
    return {**result,'decision':decision}

@pytest.mark.parametrize('index',range(8))
def test_generated_site(index,direct_vm,direct_deploy,monkeypatch):
    direct_vm._chain_id=4221
    site=SITES[index]
    addresses={parent:'0x'+format(i+700,'040x') for i,parent in enumerate(site['requires'])}
    # First load initializes the SDK. Root contract is independently usable.
    root=direct_deploy(str(ROOT/'contracts/sites/pier_hoist.py'),'{}',sdk_version='v0.2.16')
    from genlayer import gl
    from genlayer.py.public_abi import StorageType
    caller=gl.message.sender_address
    direct_vm.sender=caller
    approved=False
    constructing=True
    record_changes={}
    reads=[]
    def proxy(address):
        assert not constructing, 'Constructors must not make parent subcalls'
        parent=next(k for k,v in addresses.items() if v==str(address).lower())
        def view(*,state):
            assert state==StorageType.LATEST_FINAL
            reads.append(parent)
            return SimpleNamespace(
                get_protocol=lambda:{'protocolVersion':'repair-v1','fixtureVersion':site['version'],'chainId':4221,'sites':[parent],'architecture':'per-site-v1'},
                get_site_approval=lambda who,run,sid:({'decision':'approved','caller':str(who).lower(),'expeditionId':run,'siteId':sid,'fixtureVersion':site['version'],
                    'technicalFlags':{'operation':True},'contextFlags':dict.fromkeys(FLAGS,True),**record_changes} if approved else None))
        return SimpleNamespace(view=view)
    monkeypatch.setattr(gl,'get_contract_at',proxy)
    if index:
        # gltest 0.29.2 retains the SDK's one-module registry between loads.
        # The bootstrap root has no writes; this test deploys only one subject.
        import genlayer.gl.genvm_contracts as registry
        monkeypatch.setattr(registry,'__known_contract__',None)
    contract=root if index==0 else direct_deploy(str(ROOT/f"contracts/sites/{site['id']}.py"),json.dumps(addresses),sdk_version='v0.2.16')
    constructing=False
    assert reads==[]
    direct_vm.sender=caller
    expected_site={key:value for key,value in site.items() if key not in ('requirements','rubric','initialArtifact')}
    assert contract.get_site(site['id'])==expected_site
    assert contract.get_protocol()['dependencies']==addresses
    assert contract.get_protocol()['sites']==[site['id']]
    case=CASES[index]
    args=(RUN,site['id'],json.dumps(case['artifact']),PLAN,0)
    assert contract.prepare_repair(caller,*args)['technicalFlags']['dependencies']==(not site['requires'])
    assert contract.prepare_repair(caller,*args)['rationale']==PLAN
    if site['requires']:
        direct_vm.mock_llm('(?s).*',json.dumps(judgment(site)))
        assert contract.submit_repair(*args)['decision']=='rejected'
        assert contract.get_site_approval(caller,RUN,site['id']) is None
        args=(*args[:-1],1)
    approved=True
    if site['requires']:
        for parent in site['requires']:
            direct_vm.sender=addresses[parent]
            contract.receive_dependency_approval(caller,RUN,parent,'0x'+'a'*64)
        direct_vm.sender=caller
    direct_vm.clear_mocks()
    prompt_pattern='(?s).*'+re.escape(site['title'])+'.*'+re.escape(site['councilFacts'][0])+'.*'+re.escape('THE BUILD (already checked by contract and correct; never dispute it):')+'.*'+re.escape('BUILD CHOICES:')+'.*'+re.escape('YOUR QUESTION: '+site['councilQuestion'])+'.*PLAYER\'S ANSWER.*'+re.escape(PLAN)+'.*'
    if site['id']=='village_pump':
        prompt_pattern=prompt_pattern.replace(re.escape('THE BUILD (already checked by contract and correct; never dispute it):'),re.escape(site['councilFacts'][1])+'.*'+re.escape('THE BUILD (already checked by contract and correct; never dispute it):'))
        prompt_pattern=prompt_pattern.replace(re.escape('BUILD CHOICES:'),re.escape('Pressure 4, safe range 3–5: within range.')+'.*'+re.escape('BUILD CHOICES:'))
    direct_vm.mock_llm(prompt_pattern,json.dumps({'decision':'  revise  ','feedback':'x'*300,'unexpected':'ignored'}))
    revision=contract.submit_repair(*args)
    assert revision['decision']=='rejected'
    assert revision['rationale']==PLAN
    assert revision['feedback']=='x'*160
    assert revision['contextFlags']==dict.fromkeys(('groundedInArtifact','explainsTradeoff','protectsHabitat','safeUseAndMaintenance'),False)
    assert contract.get_site_approval(caller,RUN,site['id']) is None
    assert direct_vm.run_validator(leader_result={'decision':'revise','feedback':'Different text; same decision.'}) is True
    args=(*args[:-1],int(args[-1])+1)
    direct_vm.clear_mocks()
    direct_vm.mock_llm('(?s).*',json.dumps({'decision':'  approve  ','unexpected':'ignored'}))
    assert contract.prepare_repair(caller,*args)['technicallyValid']
    result=contract.submit_repair(*args)
    assert result['decision']=='approved'
    assert result['feedback']=='Assessment recorded.'
    if site['id']=='village_pump':
        assert result['councilResult']['decision']=='approve'
        assert result['councilResult']['chosenDesignId']=='direct_pump'
        assert result['councilResult']['quality']=='good'
        assert set(result['councilResult'])=={'schemaVersion','catalogVersion','siteId','scenarioId','chosenDesignId','decision','quality'}
        assert result['evidenceQuote'] is None
        assert result['contextFlags']=={'groundedInArtifact':True,'explainsTradeoff':True,'protectsHabitat':True,'safeUseAndMaintenance':True}
    else:
        assert 'councilResult' not in result
    assert direct_vm.run_validator() is True
    direct_vm.clear_mocks()
    direct_vm.mock_llm('(?s).*',json.dumps({'decision':'approve','feedback':'Validator wording differs.'}))
    assert direct_vm.run_validator(leader_result={'decision':'approve','feedback':'Leader wording differs.'}) is True
    direct_vm.clear_mocks()
    direct_vm.mock_llm('(?s).*',json.dumps({'decision':'revise','feedback':'Decision differs.'}))
    assert direct_vm.run_validator(leader_result={'decision':'approve','feedback':'Leader decision.'}) is False
    direct_vm.clear_mocks()
    direct_vm.mock_llm('(?s).*',json.dumps({'decision':' approve ','extra':'ignored'}))
    assert direct_vm.run_validator(leader_result={'decision':' APPROVE ','extra':'also ignored'}) is True
    for _,leader,validator in direct_vm._captured_validators:
        assert cloudpickle.dumps(leader) and cloudpickle.dumps(validator)
    assert contract.get_progress(caller,RUN)['approvedSiteIds']==[site['id']]
    assert set(reads)==set()
    with pytest.raises(Exception): contract.submit_repair(*args)
    # Only this site's catalog/technical branch; annotations survive formatting.
    canonical=(ROOT/f"contracts/sites/{site['id']}.source.py").read_text(encoding='utf-8')
    deployed=(ROOT/f"contracts/sites/{site['id']}.py").read_text(encoding='utf-8')
    assert ast.dump(ast.parse(canonical))==ast.dump(ast.parse(deployed))
    klass=next(node for node in ast.parse(canonical).body if isinstance(node,ast.ClassDef) and node.name=='IslandRepairs')
    assert sum(isinstance(node,ast.AnnAssign) and isinstance(node.target,ast.Name) and node.target.id=='dependencies' for node in klass.body)==1


def test_every_rehearsal_case_passes_contract_prepare_repair(direct_vm,direct_deploy,direct_alice,monkeypatch):
    rehearsal=json.loads(subprocess.check_output(
        ['node',str(ROOT/'tools/council-eval-rehearsal.mjs'),'--cases-only'],
        cwd=ROOT,text=True,encoding='utf-8'))
    assert rehearsal['protocol']=='council-eval-v5-offline-plan'
    assert rehearsal['runsPerCase']==3
    assert len(rehearsal['cases'])==44
    direct_vm._chain_id=4221
    direct_vm.sender=direct_alice
    bootstrap=direct_deploy(str(ROOT/'contracts/sites/pier_hoist.py'),'{}',sdk_version='v0.2.16')
    from genlayer import gl
    caller=gl.message.sender_address
    digest='0x'+'a'*64
    checked=0
    for index,site in enumerate(SITES):
        addresses={parent:'0x'+format(700+parent_index,'040x')
                   for parent_index,parent in enumerate(site['requires'])}
        if index==0:
            contract=bootstrap
        else:
            import genlayer.gl.genvm_contracts as registry
            monkeypatch.setattr(registry,'__known_contract__',None)
            contract=direct_deploy(str(ROOT/f"contracts/sites/{site['id']}.py"),json.dumps(addresses),sdk_version='v0.2.16')
        for parent in site['requires']:
            direct_vm.sender=addresses[parent]
            contract.receive_dependency_approval(caller,RUN,parent,digest)
        direct_vm.sender=caller
        site_cases=[case for case in rehearsal['cases'] if case['siteId']==site['id']]
        assert site_cases, f"No rehearsal cases for {site['id']}"
        for case in site_cases:
            prepared=contract.prepare_repair(caller,RUN,site['id'],json.dumps(case['artifact']),case['plan'],0)
            assert prepared['technicallyValid'], (case['id'],prepared['technicalFlags'])
            assert prepared['rationale']==case['plan']
            checked+=1
    assert checked==44

@pytest.mark.parametrize('mapping',['{"unexpected":"0x'+'1'*40+'"}','[]','{"x":1,"x":2}'])
def test_root_constructor_rejects_unexpected_dependencies(mapping,direct_vm,direct_deploy):
    direct_vm._chain_id=4221
    with pytest.raises(Exception):
        direct_deploy(str(ROOT/'contracts/sites/pier_hoist.py'),mapping,sdk_version='v0.2.16')


@pytest.mark.parametrize('plan',['', 'x'*14, 'x'*201, 'x'*15+'\nmore'])
def test_invalid_plan_is_rejected_before_any_validator_call(plan,direct_vm,direct_deploy):
    direct_vm._chain_id=4221
    contract=direct_deploy(str(ROOT/'contracts/sites/pier_hoist.py'),'{}',sdk_version='v0.2.16')
    caller=direct_vm.sender
    artifact=json.dumps(CASES[0]['artifact'])
    direct_vm.clear_mocks()
    with pytest.raises(Exception, match='Council plan must be one line of 15'):
        contract.prepare_repair(caller,RUN,'pier_hoist',artifact,plan,0)
    with pytest.raises(Exception, match='Council plan must be one line of 15'):
        contract.submit_repair(RUN,'pier_hoist',artifact,plan,0)
    assert direct_vm._captured_validators==[]


def test_generated_council_eval_contract_has_only_ungated_judge_api():
    source=(ROOT/'contracts/council_eval.source.py').read_text(encoding='utf-8')
    tree=ast.parse(source)
    klass=next(node for node in tree.body if isinstance(node,ast.ClassDef) and node.name=='CouncilEval')
    public_methods=[node.name for node in klass.body if isinstance(node,ast.FunctionDef) and node.name not in ('__init__',)]
    assert public_methods==['judge']
    assert [arg.arg for arg in next(node for node in klass.body if isinstance(node,ast.FunctionDef) and node.name=='judge').args.args]==['self','site_id','artifact_json','plan']
    assert '_judge_case' in source and 'configure_dependents' not in source
    deployed=(ROOT/'contracts/council_eval.py').read_text(encoding='utf-8')
    assert ast.dump(ast.parse(source))==ast.dump(ast.parse(deployed))


def test_council_eval_checks_build_and_returns_the_recorded_judgment(direct_vm,direct_deploy):
    direct_vm._chain_id=4221
    contract=direct_deploy(str(ROOT/'contracts/council_eval.py'),sdk_version='v0.2.16')
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r'(?s).*THE BUILD \(already checked by contract and correct; never dispute it\):.*Required parts: complete\..*',json.dumps({'decision':'approve','feedback':'The plan protects the shoreline.'}))
    result=contract.judge('pier_hoist',json.dumps(CASES[0]['artifact']),PLAN)
    assert result['decision']=='approve'
    assert result['case']['siteId']=='pier_hoist'
    assert result['case']['plan']==PLAN
    assert result['case']['checkedLines']


def test_council_eval_rejects_technical_failure_without_calling_council(direct_vm,direct_deploy):
    direct_vm._chain_id=4221
    contract=direct_deploy(str(ROOT/'contracts/council_eval.py'),sdk_version='v0.2.16')
    invalid=json.loads(json.dumps(CASES[0]['artifact']))
    next(part for part in invalid['parts'] if part['slotId']=='weight_b')['settingId']='rail_1000'
    direct_vm.clear_mocks()
    with pytest.raises(Exception,match='Technical build checks failed'):
        contract.judge('pier_hoist',json.dumps(invalid),PLAN)
    assert direct_vm._captured_validators==[]
